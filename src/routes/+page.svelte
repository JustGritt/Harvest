<script>
  import { onMount } from 'svelte';
  import { gameStore } from '$lib/store.ts';

  let game;
  const unsubscribe = gameStore.subscribe(value => {
    game = value;
  });

  let currentTime = Date.now();
  let progressInterval, growthInterval, farmerInterval;

  onMount(() => {
    progressInterval = setInterval(() => {
      currentTime = Date.now();
    }, 100);
    growthInterval = setInterval(() => {
      gameStore.updateGrowth();
    }, 1000);
    farmerInterval = setInterval(() => {
      gameStore.autoHarvestByFarmers();
    }, 2000);

    return () => {
      clearInterval(progressInterval);
      clearInterval(growthInterval);
      clearInterval(farmerInterval);
      unsubscribe();
    }
  });

  function plant(r, c) {
    gameStore.plantCrop(r, c);
  }
  function harvest(r, c) {
    gameStore.harvestCrop(r, c);
  }
  function expand() {
    gameStore.expandField();
  }
  function buyYield() {
    gameStore.upgradeYield();
  }
  function buySprinkler() {
    gameStore.buySprinkler();
  }
  function buyFarmer() {
    gameStore.buyFarmer();
  }
  function buySeedPlanter() {
    gameStore.buySeedPlanter();
  }
  function buyFarmerCooldown() {
    gameStore.upgradeFarmerCooldown();
  }
  function buySeedPlanterCooldown() {
    gameStore.upgradeSeedPlanterCooldown();
  }
</script>

<div class="flex">
  <div class="flex-1 p-4">
    <div class="mb-4 space-x-4">
      <span>Yield x{game.yieldMultiplier}</span>
      <span>Growth Speed x{game.growthSpeedMultiplier}</span>
      <span>Sprinklers: {game.sprinklers}</span>
      <span>Farmers: {game.farmers}</span>
      <span>Seed Planters: {game.seedPlanters}</span>
    </div>

    <div class="grid gap-2" style="grid-template-columns: repeat({game.cols}, minmax(0, 1fr));">
      {#each game.field as row, r}
        {#each row as cell, c}
          <div class="border p-4 text-center cursor-pointer bg-green-100 hover:bg-green-200 relative min-h-32 flex flex-col justify-center rounded"
            on:click={() => {
              if (cell.status === 'empty') {
                plant(r, c);
              } else if (cell.status === 'ready') {
                harvest(r, c);
              }
            }}>
            {#if cell.status === 'empty'}
              <div>Empty</div>
            {:else if cell.status === 'growing'}
              <div class="text-2xl">🌱</div>
              <div class="w-full bg-gray-300 h-2 mt-2 rounded">
                <div class="bg-green-500 h-full rounded" style="width: {Math.min(100, ((currentTime - cell.plantedAt) / (cell.readyTime - cell.plantedAt)) * 100)}%;"></div>
              </div>
              <div class="text-sm mt-1">Growing…</div>
            {:else if cell.status === 'ready'}
              <div class="text-2xl">🌸</div>
              <div>Ready!</div>
            {:else if cell.status === 'harvesting'}
              <div class="text-2xl">🚜</div>
              <div class="w-full bg-gray-300 h-2 mt-2 rounded">
                <div class="bg-red-500 h-full rounded" style="width: {Math.min(100, ((currentTime - cell.harvestStartedAt) / game.farmerHarvestTime) * 100)}%;"></div>
              </div>
              <div class="text-sm mt-1">Harvesting…</div>
            {/if}
          </div>
        {/each}
      {/each}
    </div>
  </div>
  <section class="p-4 space-y-4">
    <div class="w-64 bg-gray-200 p-4 space-y-4">
      <h3 class="font-bold text-xl">💰 {game.money}</h3>

      <div class="border p-2 rounded bg-white">
        <h4 class="font-bold mb-2">Field Upgrades</h4>
        <button class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-full" on:click={expand}>
          Expand Field ({game.expandFieldCost} 💰)
        </button>
      </div>

      <div class="border p-2 rounded bg-white">
        <h4 class="font-bold mb-2">Crop Upgrades</h4>
        <button on:click={buyYield} class="w-full bg-purple-500 text-white px-4 py-2 rounded hover:bg-purple-600">
          Upgrade Yield ({game.yieldCost} 💰)
        </button>
      </div>

      <div class="border p-2 rounded bg-white">
        <h4 class="font-bold mb-2">Automation Upgrades</h4>
        <button on:click={buySprinkler} class="w-full bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600">
          Buy Sprinkler ({game.sprinklerCost} 💰)
        </button>
        <button on:click={buyFarmer} class="w-full bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 mt-2">
          Hire Farmer ({game.farmerCost} 💰)
        </button>
        <button on:click={buySeedPlanter} class="w-full bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 mt-2">
          Purchase Seed Planter ({game.seedPlanterCost} 💰)
        </button>
        <button on:click={buyFarmerCooldown} class="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 mt-2">
          Reduce Farmer Cooldown ({game.farmerCooldownCost} 💰)
        </button>
        <button on:click={buySeedPlanterCooldown} class="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 mt-2">
          Reduce Seed Planter Cooldown ({game.seedPlanterCooldownCost} 💰)
        </button>
      </div>

      {#if game.sprinklers > 0 || game.farmers > 0 || game.seedPlanters > 0}
        <div class="border p-2 rounded bg-white">
          <h4 class="font-bold mb-2">Cooldowns</h4>
          {#if game.sprinklers > 0}
            <div class="mb-2">
              <div class="text-sm">
                Sprinkler Bonus: +{(game.sprinklers * 0.5).toFixed(1)}
              </div>
            </div>
          {/if}
          {#if game.farmers > 0}
            <div class="mb-2">
              <div class="text-sm">
                Farmer Harvest Timer: {Math.max(0, ((game.farmerHarvestDelay - (currentTime - game.lastFarmerHarvest)) / 1000)).toFixed(1)}s
              </div>
              <div class="w-full bg-gray-300 h-2 rounded">
                <div class="bg-blue-500 h-full rounded" style="width: {Math.min(100, ((currentTime - game.lastFarmerHarvest) / game.farmerHarvestDelay) * 100)}%;"></div>
              </div>
            </div>
          {/if}
          {#if game.seedPlanters > 0}
            <div>
              <div class="text-sm">
                Seed Planter Cooldown: {Math.max(0, ((game.seedPlanterCooldown - (currentTime - game.lastSeedPlanterAction)) / 1000)).toFixed(1)}s
              </div>
              <div class="w-full bg-gray-300 h-2 rounded">
                <div class="bg-yellow-500 h-full rounded" style="width: {Math.min(100, ((currentTime - game.lastSeedPlanterAction) / game.seedPlanterCooldown) * 100)}%;"></div>
              </div>
            </div>
          {/if}
        </div>
      {/if}
    </div>
  </section>
</div>