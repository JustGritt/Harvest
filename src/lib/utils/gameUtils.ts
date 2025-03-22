export function initializeField(rows: number, cols: number) {
    const field = [];
    for (let r = 0; r < rows; r++) {
        const row = [];
        for (let c = 0; c < cols; c++) {
            row.push({
                id: `${r}-${c}`,
                status: 'empty',
                plantedAt: null,
                readyTime: null,
                harvestStartedAt: null
            });
        }
        field.push(row);
    }
    return field;
}

export function scaleCost(cost: number, factor: number = 1.5): number {
    return Math.floor(cost * factor);
}