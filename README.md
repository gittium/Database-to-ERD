# Database Schema Visualization Suite

A tool to reverse-engineer a PostgreSQL database and visualize its schema as an interactive Entity-Relationship Diagram (ERD).

---

## 🚀 Features

* **Database Reverse Engineering**: Extracts tables, columns, keys, and constraints.
* **Multiple Output Formats**: Generates `schema.json` for data and `schema.dbml` for visualization.
* **Interactive ERD Viewer**:
    * Drag-and-drop tables.
    * Zoom, pan, and auto-layout controls.
    * Supports proper UML relationship notation.
    * Export the diagram as an SVG.

---

## 🛠️ How to Use

### Step 1: Extract Database Schema

1.  **Install prerequisites:**
    ```bash
    pip install sqlalchemy psycopg2-binary
    ```
2.  **Configure:** Open `erd.py` and fill in your database connection details in the `SOURCE_DB_CONFIG` dictionary.
3.  **Run the script:**
    ```bash
    python erd.py
    ```
    This command will generate `schema.dbml` and `schema.json` files.

### Step 2: Visualize the ERD

1.  **Copy DBML:** Open the generated `schema.dbml` file and copy its contents.
2.  **Open Viewer:** Open `erd.html` in your web browser.
3.  **Paste & Convert:** Paste the copied DBML code into the input box on the left and click the **Convert** button.
4.  Your interactive ERD will be displayed.

---

## License

This project is licensed under the MIT License.
