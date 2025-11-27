class Tag {
    constructor(id, name, color, userId = null, isDefault = false) {
        this.id = id;
        this.name = name;
        this.color = color;
        this.userId = userId;
        this.isDefault = isDefault; // maps to is_default column (0/1)
    }
}

module.exports = Tag;
