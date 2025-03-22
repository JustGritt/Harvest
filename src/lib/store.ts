import { writable } from 'svelte/store';

function createGameStore() {
  const { subscribe, update } = writable({
    money: 0,
    field: [],
    rows: 3,
    cols: 3,
    yieldMultiplier: 10,
    growthSpeedMultiplier: 1,
    autoHarvest: false,
    sprinklers: 0,
    farmers: 0,
    seedPlanters: 0,
    sprinklerCost: 200,
    farmerCost: 300,
    seedPlanterCost: 250,
    yieldCost: 100,
    growthCost: 150,
    expandFieldCost: 500,
    lastSeedPlanterAction: 0,
    seedPlanterCooldown: 10000,
    seedPlanterCooldownCost: 250,
    lastFarmerHarvest: 0,
    farmerHarvestDelay: 10000,
    farmerHarvestTime: 3000,
    farmerCooldownCost: 250
  });

  function initializeField(rows: number, cols: number) {
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

  update(state => ({
    ...state,
    field: initializeField(state.rows, state.cols)
  }));

  function autoHarvestByFarmers() {
    update(state => {
      const now = Date.now();
      for (let r = 0; r < state.field.length; r++) {
        for (let c = 0; c < state.field[r].length; c++) {
          const cell = state.field[r][c];
          if (cell.status === 'harvesting' && now - cell.harvestStartedAt >= state.farmerHarvestTime) {
            cell.status = 'empty';
            cell.harvestStartedAt = null;
            cell.plantedAt = null;
            cell.readyTime = null;
            state.money += 10 * state.yieldMultiplier;
          }
        }
      }
      let activeHarvests = 0;
      for (let row of state.field) {
        for (let cell of row) {
          if (cell.status === 'harvesting') activeHarvests++;
        }
      }
      let availableFarmers = state.farmers - activeHarvests;
      if (availableFarmers > 0 && (now - state.lastFarmerHarvest) >= state.farmerHarvestDelay) {
        for (let r = 0; r < state.field.length; r++) {
          for (let c = 0; c < state.field[r].length; c++) {
            if (availableFarmers <= 0) break;
            const cell = state.field[r][c];
            if (cell.status === 'ready') {
              cell.status = 'harvesting';
              cell.harvestStartedAt = now;
              availableFarmers--;
            }
          }
          if (availableFarmers <= 0) break;
        }
        state.lastFarmerHarvest = now;
      }
      if (state.seedPlanters > 0 && (now - state.lastSeedPlanterAction) >= state.seedPlanterCooldown) {
        let remainingSeedPlanters = state.seedPlanters;
        for (let r = 0; r < state.field.length; r++) {
          for (let c = 0; c < state.field[r].length; c++) {
            if (remainingSeedPlanters <= 0) break;
            const cell = state.field[r][c];
            if (cell.status === 'empty') {
              cell.status = 'growing';
              cell.plantedAt = now;
              // Updated sprinkler multiplier from 0.2 to 0.5
              cell.readyTime = now + (5000 / (state.growthSpeedMultiplier + state.sprinklers * 0.5));
              remainingSeedPlanters--;
            }
          }
          if (remainingSeedPlanters <= 0) break;
        }
        state.lastSeedPlanterAction = now;
      }
      return state;
    });
  }

  return {
    subscribe,
    plantCrop: (r: number, c: number) => {
      update(state => {
        const cell = state.field[r][c];
        if (cell.status === 'empty') {
          cell.status = 'growing';
          cell.plantedAt = Date.now();
          // Updated sprinkler multiplier
          cell.readyTime = cell.plantedAt + (5000 / (state.growthSpeedMultiplier + state.sprinklers * 0.5));
        }
        return state;
      });
    },
    harvestCrop: (r: number, c: number) => {
      update(state => {
        const cell = state.field[r][c];
        if ((cell.status === 'growing' && Date.now() >= cell.readyTime) || cell.status === 'ready') {
          cell.status = 'empty';
          cell.plantedAt = null;
          cell.readyTime = null;
          state.money += 10 * state.yieldMultiplier;
        }
        return state;
      });
    },
    expandField: () => {
      update(state => {
        if (state.money >= state.expandFieldCost) {
          state.money -= state.expandFieldCost;
          state.rows += 1;
          const newRow = [];
          for (let c = 0; c < state.cols; c++) {
            newRow.push({
              id: `${state.rows - 1}-${c}`,
              status: 'empty',
              plantedAt: null,
              readyTime: null,
              harvestStartedAt: null
            });
          }
          state.field.push(newRow);
          state.expandFieldCost = Math.floor(state.expandFieldCost * 1.2);
        }
        return state;
      });
    },
    updateGrowth: () => {
      update(state => {
        state.field.forEach(cellRow => {
          cellRow.forEach(cell => {
            if (cell.status === 'growing' && Date.now() >= cell.readyTime) {
              cell.status = 'ready';
            }
          });
        });
        return state;
      });
    },
    upgradeYield: () => {
      update(state => {
        if (state.money >= state.yieldCost) {
          state.money -= state.yieldCost;
          state.yieldMultiplier += 1;
          state.yieldCost = Math.floor(state.yieldCost * 1.5);
        }
        return state;
      });
    },
    // Removed upgradeGrowth from the returned API
    buySprinkler: () => {
      update(state => {
        if (state.money >= state.sprinklerCost) {
          state.money -= state.sprinklerCost;
          state.sprinklers += 1;
          state.sprinklerCost = Math.floor(state.sprinklerCost * 1.5);
        }
        return state;
      });
    },
    buyFarmer: () => {
      update(state => {
        if (state.money >= state.farmerCost) {
          state.money -= state.farmerCost;
          state.farmers += 1;
          state.farmerCost = Math.floor(state.farmerCost * 1.5);
          state.lastFarmerHarvest = Date.now();
        }
        return state;
      });
    },
    buySeedPlanter: () => {
      update(state => {
        if (state.money >= state.seedPlanterCost) {
          state.money -= state.seedPlanterCost;
          state.seedPlanters += 1;
          state.seedPlanterCost = Math.floor(state.seedPlanterCost * 1.5);
          state.lastSeedPlanterAction = Date.now();
        }
        return state;
      });
    },
    upgradeFarmerCooldown: () => {
      update(state => {
        if (state.money >= state.farmerCooldownCost) {
          state.money -= state.farmerCooldownCost;
          state.farmerHarvestDelay = Math.max(2000, state.farmerHarvestDelay - 1000);
          state.farmerCooldownCost = Math.floor(state.farmerCooldownCost * 1.5);
        }
        return state;
      });
    },
    upgradeSeedPlanterCooldown: () => {
      update(state => {
        if (state.money >= state.seedPlanterCooldownCost) {
          state.money -= state.seedPlanterCooldownCost;
          state.seedPlanterCooldown = Math.max(2000, state.seedPlanterCooldown - 1000);
          state.seedPlanterCooldownCost = Math.floor(state.seedPlanterCooldownCost * 1.5);
        }
        return state;
      });
    },
    autoHarvestByFarmers
  };
}

export const gameStore = createGameStore();