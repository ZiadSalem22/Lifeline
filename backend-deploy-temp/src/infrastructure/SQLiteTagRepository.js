const Tag = require('../domain/Tag');

class SQLiteTagRepository {
    constructor(db) {
        this.db = db;
    }

    findAll() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM tags', (err, rows) => {
                if (err) reject(err);
                else resolve(rows.map(row => new Tag(row.id, row.name, row.color)));
            });
        });
    }

    findById(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM tags WHERE id = ?', [id], (err, row) => {
                if (err) reject(err);
                else if (row) resolve(new Tag(row.id, row.name, row.color));
                else resolve(null);
            });
        });
    }

    findByName(name) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM tags WHERE name = ?', [name], (err, row) => {
                if (err) reject(err);
                else if (row) resolve(new Tag(row.id, row.name, row.color));
                else resolve(null);
            });
        });
    }

    save(tag) {
        return new Promise((resolve, reject) => {
            const stmt = this.db.prepare('INSERT OR REPLACE INTO tags (id, name, color) VALUES (?, ?, ?)');
            stmt.run(tag.id, tag.name, tag.color, (err) => {
                if (err) reject(err);
                else resolve();
            });
            stmt.finalize();
        });
    }

    delete(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM tags WHERE id = ?', [id], (err) => {
                if (err) reject(err);
                else resolve();
            });
        });
    }
}

module.exports = SQLiteTagRepository;
