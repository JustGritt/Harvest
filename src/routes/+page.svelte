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
  function buyFertilizer() {
    gameStore.upgradeFertilizer();
  }
</script>

<section class="relative flex">
  <div class="flex-1 p-4 pr-0">
    <div class="grid gap-2" style="grid-template-columns: repeat({game.cols}, minmax(0, 1fr));">
      {#each game.field as row, r}
        {#each row as cell, c}
          <div class="border border-green-700 p-4 text-center cursor-pointer bg-green-100 hover:bg-green-200 relative min-h-32 flex flex-col justify-center rounded"
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
    <div class="sticky top-4 w-64 bg-green-100 border border-green-700 rounded p-4 space-y-4">
      <h3 class="font-bold text-xl truncate">💰 {game.money}</h3>

    <div class="border border-green-700 p-2 rounded bg-white">
      <h4 class="font-bold mb-2">Automation Upgrades</h4>

      <button on:click={buySprinkler} class="w-full bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600">
        Buy Sprinkler ({game.sprinklerCost} 💰)
      </button>
      <p class="text-xs text-gray-600 mt-1">
        Sprinklers boost crop growth speed.
      </p>

      <button on:click={buyFarmer} class="w-full bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 mt-2">
        Hire Farmer ({game.farmerCost} 💰)
      </button>
      <p class="text-xs text-gray-600 mt-1">
        Farmers automatically harvest ready crops.
      </p>

      <button on:click={buySeedPlanter} class="w-full bg-orange-500 text-white px-4 py-2 rounded hover:bg-orange-600 mt-2">
        Purchase Seed Planter ({game.seedPlanterCost} 💰)
      </button>
      <p class="text-xs text-gray-600 mt-1">
        Seed Planters help plant crops in empty plots.
      </p>
    </div>

    {#if game.farmers > 0 || game.seedPlanters > 0}
      <div class="border border-green-700 p-2 rounded bg-white">
        <h4 class="font-bold mb-2">Automation Cooldowns</h4>

        {#if game.farmers > 0}
          <button on:click={buyFarmerCooldown} class="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 mt-2">
            Reduce Farmer Cooldown ({game.farmerCooldownCost} 💰)
          </button>
          <p class="text-xs text-gray-600 mt-1">
            Shorten the waiting time between farmer harvests.
          </p>
        {/if}

        {#if game.seedPlanters > 0}
          <button on:click={buySeedPlanterCooldown} class="w-full bg-green-500 text-white px-4 py-2 rounded hover:bg-green-600 mt-2">
            Reduce Seed Planter Cooldown ({game.seedPlanterCooldownCost} 💰)
          </button>
          <p class="text-xs text-gray-600 mt-1">
            Decrease the delay before seed planters engage.
          </p>
        {/if}
      </div>
    {/if}

    <div class="border border-green-700 p-2 rounded bg-white">
      <h4 class="font-bold mb-2">Advanced Upgrades</h4>

      <button class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-full" on:click={expand}>
        Expand Field ({game.expandFieldCost} 💰)
      </button>

      <button on:click={buyFertilizer} class="bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 w-full mt-2">
        Fertilizer Upgrade ({game.fertilizerCost} 💰)
      </button>
    </div>

      {#if game.sprinklers > 0 || game.farmers > 0 || game.seedPlanters > 0}
        <div class="border border-green-700 p-2 rounded bg-white">
          <h4 class="font-bold mb-2">Cooldowns</h4>
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

      <div class="border border-green-700 p-2 rounded bg-white">
        <h4 class="font-bold mb-2">Game Stats</h4>

        <section class="border-t border-gray-300 pt-2 mt-2">
          <div class="flex w-full justify-between text-sm">
            Sprinklers
            <span class="font-bold">
              {game.sprinklers}
            </span>
          </div>

          <div class="flex w-full justify-between text-sm">
            Sprinklers reduction
            <span class="font-bold">
                {#if game.sprinklers > 0}
                  {(game.sprinklers * 0.5).toFixed(1)}s
                {:else}
                  0s
                {/if}
            </span>
          </div>
        </section>

        <section class="border-t border-gray-300 pt-2 mt-2">
          <div class="flex w-full justify-between text-sm">
            Farmers
            <span class="font-bold">
              {game.farmers}
            </span>
          </div>

          <div class="flex w-full justify-between text-sm">
            Farmers harvest
            <span class="font-bold">
              {game.farmerHarvestDelay / 1000}s
            </span>
          </div>
        </section>


        <section class="border-t border-gray-300 pt-2 mt-2">
          <div class="flex w-full justify-between text-sm">
            Seed Planters
            <span class="font-bold">
              {game.seedPlanters}
            </span>
          </div>

          <div class="flex w-full justify-between text-sm">
            Seed Planters cooldown
            <span class="font-bold">
              {game.seedPlanterCooldown / 1000}s
            </span>
          </div>
        </section>

        <section class="border-t border-gray-300 pt-2 mt-2">
          <div class="flex w-full justify-between text-sm">
            Field size
            <span class="font-bold">
              {game.rows}
            </span>
          </div>

          <div class="flex w-full justify-between text-sm">
            Fertilizer level
            <span class="font-bold">
              {game.fertilizerLevel}
            </span>
          </div>
        </section>

        <section class="border-t border-gray-300 pt-2 mt-2">
          <div class="flex w-full justify-between text-sm">
            Time elapsed
            <span class="font-bold">
              {((currentTime - game.startTime) / 1000).toFixed(0)}s
            </span>
          </div>
        </section>
      </div>

    </div>
  </section>
</section>