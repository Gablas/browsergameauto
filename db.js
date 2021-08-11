const { Low, JSONFile } = require("lowdb");
const { join } = require("path");

async function main() {
    // Use JSON file for storage
    const file = join(__dirname, "db.json");
    const adapter = new JSONFile(file);
    const db = new Low(adapter);

    // Read data from JSON file, this will set db.data content
    await db.read();

    console.log(db);
}
