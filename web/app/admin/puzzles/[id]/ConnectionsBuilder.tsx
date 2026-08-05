'use client';

import { useEffect, useState } from 'react';

interface Props {
    question: string;
    answer: string;
    onChange: (question: string, answer: string) => void;
}

type Group = {
    category: string;
    items: GroupItem[];
};

type GroupItem = {
    id: number;
    value: string;
};

type ConnectionsQuestion = {
    prompt: string;
    items: string[];
    categories: string[];
};

const MIN_GROUPS = 2;
const MIN_ITEMS_PER_GROUP = 2;

function defaultGroups(): Group[] {
    return [
        {
            category: 'Group 1',
            items: [
                { id: 0, value: 'Item A' },
                { id: 1, value: 'Item B' },
            ],
        },
        {
            category: 'Group 2',
            items: [
                { id: 2, value: 'Item C' },
                { id: 3, value: 'Item D' },
            ],
        },
    ];
}

function parseQuestion(question: string): ConnectionsQuestion | null {
    try {
        const parsed = JSON.parse(question) as {
            prompt?: unknown;
            items?: unknown;
            categories?: unknown;
        };
        if (
            typeof parsed.prompt !== 'string' ||
            !Array.isArray(parsed.items) ||
            !Array.isArray(parsed.categories) ||
            parsed.categories.length < MIN_GROUPS ||
            parsed.items.length < parsed.categories.length ||
            parsed.items.length % parsed.categories.length !== 0
        ) {
            return null;
        }

        return {
            prompt: parsed.prompt,
            items: parsed.items.map((item) => String(item ?? '')),
            categories: parsed.categories.map((category) => String(category ?? '')),
        };
    } catch {
        return null;
    }
}

function parseAnswer(answer: string, itemCount: number, groupCount: number) {
    const groups = answer.split('|').map((group) =>
        group
            .split(',')
            .map((part) => Number(part.trim()))
            .filter((index) => Number.isInteger(index))
    );
    const allIndices = groups.flat();
    const valid =
        groups.length === groupCount &&
        allIndices.length === itemCount &&
        new Set(allIndices).size === itemCount &&
        allIndices.every((index) => index >= 0 && index < itemCount);

    if (valid) return groups;

    const groupSize = itemCount / groupCount;
    return Array.from({ length: groupCount }, (_, groupIndex) =>
        Array.from({ length: groupSize }, (_, itemIndex) => groupIndex * groupSize + itemIndex)
    );
}

function parseGroups(question: string, answer: string) {
    const parsed = question ? parseQuestion(question) : null;
    if (!parsed) return { prompt: 'Find the groups:', groups: defaultGroups() };

    const answerGroups = parseAnswer(answer, parsed.items.length, parsed.categories.length);
    const groups = parsed.categories.map((category, categoryIndex) => ({
        category,
        items: answerGroups[categoryIndex].map((itemIndex) => ({
            id: itemIndex,
            value: parsed.items[itemIndex] ?? '',
        })),
    }));

    return { prompt: parsed.prompt, groups };
}

function buildQuestion(prompt: string, groups: Group[]) {
    const items = groups
        .flatMap((group) => group.items)
        .sort((a, b) => a.id - b.id)
        .map((item) => item.value.trim());
    return JSON.stringify({
        prompt: prompt.trim() || 'Find the groups:',
        items,
        categories: groups.map((group) => group.category.trim()),
    });
}

function buildAnswer(groups: Group[]) {
    const orderedItems = groups.flatMap((group) => group.items).sort((a, b) => a.id - b.id);
    const indexById = new Map(orderedItems.map((item, index) => [item.id, index]));
    return groups
        .map((group) => group.items.map((item) => indexById.get(item.id)).join(','))
        .join('|');
}

export default function ConnectionsBuilder({ question, answer, onChange }: Props) {
    const [prompt, setPrompt] = useState('Find the groups:');
    const [groups, setGroups] = useState<Group[]>(() => defaultGroups());
    const [initialised, setInitialised] = useState(false);

    useEffect(() => {
        if (initialised) return;
        setInitialised(true);

        const parsed = parseGroups(question, answer);
        setPrompt(parsed.prompt);
        setGroups(parsed.groups);
        onChange(buildQuestion(parsed.prompt, parsed.groups), buildAnswer(parsed.groups));
    }, [answer, initialised, onChange, question]);

    function emit(nextPrompt: string, nextGroups: Group[]) {
        onChange(buildQuestion(nextPrompt, nextGroups), buildAnswer(nextGroups));
    }

    function handlePromptChange(value: string) {
        setPrompt(value);
        emit(value, groups);
    }

    function handleCategoryChange(groupIndex: number, value: string) {
        const nextGroups = groups.map((group, index) =>
            index === groupIndex ? { ...group, category: value } : group
        );
        setGroups(nextGroups);
        emit(prompt, nextGroups);
    }

    function handleItemChange(groupIndex: number, itemIndex: number, value: string) {
        const nextGroups = groups.map((group, index) =>
            index === groupIndex
                ? {
                      ...group,
                      items: group.items.map((item, currentItemIndex) =>
                          currentItemIndex === itemIndex ? { ...item, value } : item
                      ),
                  }
                : group
        );
        setGroups(nextGroups);
        emit(prompt, nextGroups);
    }

    function handleAddGroup() {
        const itemCount = groups[0]?.items.length ?? MIN_ITEMS_PER_GROUP;
        const nextItemId =
            Math.max(-1, ...groups.flatMap((group) => group.items.map((item) => item.id))) + 1;
        const nextGroups = [
            ...groups,
            {
                category: `Group ${groups.length + 1}`,
                items: Array.from({ length: itemCount }, (_, index) => ({
                    id: nextItemId + index,
                    value: `Item ${groups.length + 1}.${index + 1}`,
                })),
            },
        ];
        setGroups(nextGroups);
        emit(prompt, nextGroups);
    }

    function handleRemoveGroup(groupIndex: number) {
        if (groups.length <= MIN_GROUPS) return;
        const nextGroups = groups.filter((_, index) => index !== groupIndex);
        setGroups(nextGroups);
        emit(prompt, nextGroups);
    }

    return (
        <div
            data-testid="connections-builder"
            style={{ display: 'flex', flexDirection: 'column', gap: 18 }}
        >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <label style={{ color: 'var(--muted)', fontSize: '0.9em' }}>Prompt</label>
                <input
                    type="text"
                    value={prompt}
                    onChange={(e) => handlePromptChange(e.target.value)}
                    required
                    data-testid="connections-prompt"
                    placeholder="Find the groups:"
                    style={{ width: '100%', maxWidth: 680 }}
                />
            </div>

            {groups.map((group, groupIndex) => (
                <div
                    key={groupIndex}
                    style={{
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: 12,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 10,
                    }}
                >
                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'minmax(160px, 1fr) auto',
                            gap: 8,
                            alignItems: 'center',
                        }}
                    >
                        <input
                            type="text"
                            value={group.category}
                            onChange={(e) => handleCategoryChange(groupIndex, e.target.value)}
                            required
                            data-testid={`connections-category-${groupIndex}`}
                            placeholder="Category"
                            style={{ width: '100%' }}
                        />
                        {groups.length > MIN_GROUPS && (
                            <button
                                type="button"
                                className="action-btn"
                                onClick={() => handleRemoveGroup(groupIndex)}
                                style={{ padding: '2px 8px', fontSize: '0.85em' }}
                            >
                                Remove group
                            </button>
                        )}
                    </div>

                    <div
                        style={{
                            display: 'grid',
                            gridTemplateColumns: 'repeat(2, minmax(140px, 1fr))',
                            gap: 8,
                        }}
                    >
                        {group.items.map((item, itemIndex) => (
                            <input
                                key={item.id}
                                type="text"
                                value={item.value}
                                onChange={(e) =>
                                    handleItemChange(groupIndex, itemIndex, e.target.value)
                                }
                                required
                                data-testid={`connections-item-${groupIndex}-${itemIndex}`}
                                placeholder={`Item ${itemIndex + 1}`}
                                style={{ width: '100%' }}
                            />
                        ))}
                    </div>
                </div>
            ))}

            <button
                type="button"
                className="action-btn"
                onClick={handleAddGroup}
                style={{ padding: '4px 10px', alignSelf: 'flex-start' }}
            >
                + Add group
            </button>

            <div className="muted" style={{ fontSize: '0.9em' }}>
                Categories and their items are saved to the puzzle JSON. The answer is saved as one
                index group per category.
            </div>
        </div>
    );
}
