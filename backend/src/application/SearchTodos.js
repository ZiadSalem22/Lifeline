class SearchTodos {
    constructor(todoRepository) {
        this.todoRepository = todoRepository;
    }

    /**
     * Execute search with a filters object.
     * Supported filters: q, tags (array), priority, status ('completed'|'active'), startDate, endDate, minDuration, maxDuration, flagged (boolean), sortBy
     */
    async execute(userId, filters = {}) {
        return this.todoRepository.findByFilters({ ...filters, userId });
    }
}

module.exports = SearchTodos;
