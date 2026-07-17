/** Query keys shared by the todos hooks and cross-feature consumers (the
 * daily-plan habit sync) — a separate module so neither side imports the
 * other's hooks. */
export const todosQueryKey = (guest: boolean) => ['todos', guest ? 'guest' : 'server'] as const;
export const tagsQueryKey = (guest: boolean) => ['tags', guest ? 'guest' : 'server'] as const;
