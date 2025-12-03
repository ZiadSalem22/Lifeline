from pathlib import Path

base_path = Path('app_base.jsx')
target_path = Path('client/src/app/App.jsx')

text = base_path.read_text().replace('\r\n', '\n')
start_marker = """              <div
                className=\"fade-in-slide-down\"
                style={{ marginBottom: '48px' }}
              >"""
end_marker = """                </div>
              )}
            </div>"""
new_block = """              <div className=\"fade-in-slide-down home-hero\">
                <div className=\"header-content\">
                  <h1 className=\"header-title\">
                    {title}
                  </h1>
                  {durationString && (
                    <span className=\"scale-in duration-pill\">
                      {durationString}
                    </span>
                  )}
                </div>

                <div className=\"home-progress-row\">
                  <p className=\"home-progress-text\">
                    {completedCount} of {filteredTodos.length} completed
                  </p>
                  {filteredTodos.length > 0 && (
                    <div className=\"home-progress-meter\">
                      <div className=\"home-progress-track\">
                        <div
                          className=\"progress-bar-fill\"
                          style={{
                            width: `${progress}%`
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                {!searchActive && (
                  <div className=\"home-filters-row\">
                  {/* Tag Filter */}
                  {tags.length > 0 && (
                    <div className=\"home-filter-chips\">
                      <span className=\"home-filter-label\">Filter:</span>
                      {tags.map(tag => (
                        <button
                          key={tag.id}
                          type=\"button\"
                          className={`home-filter-chip ${selectedFilterTags.includes(tag.id) ? 'home-filter-chip--active' : ''}`}
                          style={{ '--chip-color': tag.color }}
                          onClick={() => {
                            setSelectedFilterTags(prev =>
                              prev.includes(tag.id)
                                ? prev.filter(id => id !== tag.id)
                                : [...prev, tag.id]
                            );
                          }}
                        >
                          {tag.name}
                        </button>
                      ))}
                      {selectedFilterTags.length > 0 && (
                        <button
                          type=\"button\"
                          className=\"home-filter-chip\"
                          onClick={() => setSelectedFilterTags([])}
                        >
                          Clear
                        </button>
                      )}
                    </div>
                  )}
                  
                  {/* Sort Dropdown */}
                  <select
                    value={sortOption}
                    onChange={(e) => setSortOption(e.target.value)}
                    className=\"home-sort-select\"
                  >
                    <option value=\"date\">Sort by Date</option>
                    <option value=\"priority\">Sort by Priority</option>
                    <option value=\"duration\">Sort by Duration</option>
                    <option value=\"name\">Sort by Name</option>
                  </select>
                  
                  </div>
                )}
              </div>"""

def replace_once(content):
    start = content.find(start_marker)
    if start == -1:
        raise SystemExit('Start marker not found')
    end = content.find(end_marker, start)
    if end == -1:
        raise SystemExit('End marker not found')
    end += len(end_marker)
    return content[:start] + new_block + content[end:]

modified = text
for _ in range(2):
    modified = replace_once(modified)

target_path.write_text(modified)
