class GetStatistics {
    constructor(todoRepository) {
        this.todoRepository = todoRepository;
    }

    async execute() {
        return await this.todoRepository.getStatistics();
    }
}

module.exports = GetStatistics;
