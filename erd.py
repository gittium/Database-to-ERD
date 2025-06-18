import json
import os
from sqlalchemy import (
    create_engine, 
    inspect, 
    MetaData, 
    Table, 
    Column, 
    ForeignKeyConstraint,
    text
)
from sqlalchemy.dialects.postgresql import dialect as postgresql_dialect

# --- Configuration ---
# IMPORTANT: Fill in your source database connection details here.
SOURCE_DB_CONFIG = {
    "user": ".",
    "password": ".",
    "host": "localhost",
    "port": "5432",
    "dbname": ".",
}



# Output filenames
JSON_OUTPUT_FILE = "schema.json"
DBML_OUTPUT_FILE = "schema.dbml"


def extract_schema_to_json(engine):
    """
    Inspects the database and extracts its full schema into a JSON-compatible dictionary.
    """
    print("--- Starting Schema Extraction ---")
    inspector = inspect(engine)
    schema_data = {"schemas": {}}

    for schema_name in inspector.get_schema_names():
        # We often want to skip system schemas.
        if schema_name.startswith('pg_') or schema_name in ['information_schema']:
            continue
        
        print(f"Processing schema: {schema_name}")
        schema_data["schemas"][schema_name] = {
            "tables": {},
            "views": {}
        }

        # --- Process Tables ---
        for table_name in inspector.get_table_names(schema=schema_name):
            print(f"  - Extracting table: {table_name}")
            pk_constraint = inspector.get_pk_constraint(table_name, schema=schema_name)
            
            table_info = {
                "columns": [],
                "primary_key": pk_constraint['constrained_columns'] if pk_constraint else [],
                "foreign_keys": inspector.get_foreign_keys(table_name, schema=schema_name),
                "unique_constraints": inspector.get_unique_constraints(table_name, schema=schema_name),
                "indexes": inspector.get_indexes(table_name, schema=schema_name),
            }

            for column in inspector.get_columns(table_name, schema=schema_name):
                # The data type needs to be converted to a string to be JSON serializable.
                column['type'] = str(column['type'])
                table_info["columns"].append(column)
            
            schema_data["schemas"][schema_name]["tables"][table_name] = table_info
            
        # --- Process Views ---
        for view_name in inspector.get_view_names(schema=schema_name):
            print(f"  - Extracting view: {view_name}")
            try:
                view_def = inspector.get_view_definition(view_name, schema=schema_name)
                schema_data["schemas"][schema_name]["views"][view_name] = {"definition": view_def}
            except Exception as e:
                 print(f"    Could not get definition for view {view_name}: {e}")


    print("--- Schema Extraction Finished ---")
    return schema_data


def generate_dbml_from_json(schema_data):
    """
    Generates a DBML (dbdiagram.io) string from the schema JSON data.
    """
    print("--- Generating DBML for dbdiagram.io ---")
    dbml_lines = []
    
    # We will process all tables first, then all relationships for clarity
    all_foreign_keys = []

    for schema_name, schema_content in schema_data["schemas"].items():
        for table_name, table_info in schema_content["tables"].items():
            full_table_name = f"{schema_name}.{table_name}"
            dbml_lines.append(f"Table {full_table_name} {{")
            
            for column in table_info["columns"]:
                col_name = column['name']
                col_type = column['type']
                
                attributes = []
                if col_name in table_info.get("primary_key", []):
                    attributes.append("pk")
                
                if not column['nullable']:
                    attributes.append("not null")

                if column.get('default'):
                    # Handle different default types
                    default_val = column['default']
                    if isinstance(default_val, str) and "nextval" in default_val:
                         attributes.append("increment")
                    else:
                         attributes.append(f"default: `{default_val}`")
                
                attr_str = f"[{', '.join(attributes)}]" if attributes else ""
                dbml_lines.append(f"  {col_name} {col_type} {attr_str}")

            dbml_lines.append("}\n")

            # Collect all foreign keys to define them later using the Ref syntax
            for fk in table_info["foreign_keys"]:
                fk['source_table'] = full_table_name
                all_foreign_keys.append(fk)
    
    # Now, define all relationships using the Ref syntax
    dbml_lines.append("// --- Relationships ---")
    for fk in all_foreign_keys:
        source_table = fk['source_table']
        source_cols = fk['constrained_columns']
        
        target_schema = fk['referred_schema'] if fk['referred_schema'] else 'public'
        target_table = f"{target_schema}.{fk['referred_table']}"
        target_cols = fk['referred_columns']

        # Determine relationship type (one-to-one or one-to-many)
        # It's one-to-one if the foreign key column(s) are also part of a unique constraint.
        is_one_to_one = False
        source_table_info = schema_data["schemas"][source_table.split('.')[0]]["tables"][source_table.split('.')[1]]
        for uc in source_table_info['unique_constraints']:
            if set(source_cols) == set(uc['column_names']):
                is_one_to_one = True
                break
        
        rel_symbol = "-" if is_one_to_one else "<" # '-' for one-to-one, '<' for one-to-many

        # DBML Ref syntax is simpler with single column keys
        if len(source_cols) == 1:
            dbml_lines.append(f"Ref: {source_table}.{source_cols[0]} {rel_symbol} {target_table}.{target_cols[0]}")
        else: # Handle composite keys with a note
             dbml_lines.append(f"// Composite Ref: {source_table}({source_cols}) {rel_symbol} {target_table}({target_cols})")


    print("--- DBML Generation Finished ---")
    return "\n".join(dbml_lines)



if __name__ == "__main__":
    source_db_uri = f"postgresql://{SOURCE_DB_CONFIG['user']}:{SOURCE_DB_CONFIG['password']}@{SOURCE_DB_CONFIG['host']}:{SOURCE_DB_CONFIG['port']}/{SOURCE_DB_CONFIG['dbname']}"
    engine = create_engine(source_db_uri)

    try:
        # 1. Extract schema to a Python dictionary
        schema_dict = extract_schema_to_json(engine)

        # 2. Save the dictionary as a JSON file, ensuring UTF-8 encoding
        with open(JSON_OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(schema_dict, f, indent=4, ensure_ascii=False)
        print(f"\nSchema successfully saved to '{JSON_OUTPUT_FILE}'")

        # 3. Generate DBML from the dictionary
        dbml_content = generate_dbml_from_json(schema_dict)

        # 4. Save the DBML to a file, ensuring UTF-8 encoding
        with open(DBML_OUTPUT_FILE, 'w', encoding='utf-8') as f:
            f.write(dbml_content)
        print(f"DBML diagram code successfully saved to '{DBML_OUTPUT_FILE}'")
        

        # 5. (Optional) Recreate the database from the JSON file
        # Uncomment the line below to run this functionality.
        # recreate_db_from_json(schema_dict, TARGET_DB_CONFIG)

    except Exception as e:
        print(f"\nAn error occurred: {e}")
