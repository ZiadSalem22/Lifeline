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
            // Enforce unique tag names (case-insensitive)
            this.db.get('SELECT * FROM tags WHERE LOWER(name) = LOWER(?) AND id != ?', [tag.name, tag.id || ''], (err, row) => {
                if (err) return reject(err);
                if (row) {
                    // Tag name already exists (different id)
                    const error = new Error('Tag name already exists');
                    error.code = 'TAG_NAME_EXISTS';
                    return reject(error);
                }
                const stmt = this.db.prepare('INSERT OR REPLACE INTO tags (id, name, color) VALUES (?, ?, ?)');
                stmt.run(tag.id, tag.name, tag.color, (err2) => {
                    if (err2) reject(err2);
                    else resolve();
                });
                stmt.finalize();
            });
        });
    }

    delete(id) {
        // Delete tag and its todo_tags in a transaction
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('BEGIN TRANSACTION');
                this.db.run('DELETE FROM todo_tags WHERE tag_id = ?', [id], (err1) => {
                    if (err1) {
                        this.db.run('ROLLBACK');
                        return reject(err1);
                    }
                    this.db.run('DELETE FROM tags WHERE id = ?', [id], (err2) => {
                        if (err2) {
                            this.db.run('ROLLBACK');
                            return reject(err2);
                        }
                        this.db.run('COMMIT', (err3) => {
                            if (err3) return reject(err3);
                            resolve();
                        });
                    });
                });
            });
        });
    }
}

module.exports = SQLiteTagRepository;
