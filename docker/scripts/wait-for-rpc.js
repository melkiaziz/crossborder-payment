const rpcUrl = process.env.RPC_URL || process.env.HARDHAT_RPC_URL || 'http://blockchain:8545';

async function waitForRpc(maxAttempts = 60, delayMs = 2000) {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await fetch(rpcUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          method: 'eth_blockNumber',
          params: [],
          id: 1,
        }),
      });

      const payload = await response.json();
      if (payload.result) {
        console.log(`✅ RPC disponible (${rpcUrl})`);
        return;
      }
    } catch {
      // Hardhat node not ready yet
    }

    console.log(`⏳ Attente du noeud blockchain (${attempt}/${maxAttempts})...`);
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  throw new Error(`RPC indisponible après ${maxAttempts} tentatives: ${rpcUrl}`);
}

waitForRpc().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
