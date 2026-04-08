import { logger } from '../utils/logger.js';
import Web3 from 'web3';

/**
 * DEX Integration Service
 * Supports PancakeSwap, SushiSwap, and Uniswap V3
 */
export class DEXIntegration {
  constructor(wss) {
    this.wss = wss;
    this.dexes = new Map();
    this.isInitialized = false;
    
    // DEX configurations
    this.dexConfigs = {
      pancakeswap: {
        name: 'PancakeSwap',
        chain: 'bsc',
        chainId: 56,
        factory: '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
        router: '0x10ED43C718714eb63d5aA57B78B54704E256024E',
        rpcUrl: 'https://bsc-dataseed1.binance.org/',
        feeTiers: [100, 500, 3000, 10000],
        blockTime: 3
      },
      sushiswap: {
        name: 'SushiSwap',
        chain: 'ethereum',
        chainId: 1,
        factory: '0xC0AEe478e3658e2610c5F7A4A2E1777cE9e4f2Ac',
        router: '0xd9e1cE17f2641f24aE83637ab66a2cca9C378B9F',
        rpcUrl: 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
        feeTiers: [500, 3000, 10000],
        blockTime: 12
      },
      uniswap_v3: {
        name: 'Uniswap V3',
        chain: 'ethereum',
        chainId: 1,
        factory: '0x1F98431c8aD98523631AE4a59f267346ea31F984',
        router: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        quoter: '0xb27308f9F90D607463bb33eA1BeBb41C27CE5AB6',
        rpcUrl: 'https://mainnet.infura.io/v3/YOUR_INFURA_KEY',
        feeTiers: [100, 500, 3000, 10000],
        blockTime: 12
      }
    };
    
    // Token addresses (common tokens)
    this.tokenAddresses = {
      bsc: {
        WBNB: '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
        BUSD: '0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56',
        USDT: '0x55d398326f99059fF775485246999027B3197955',
        USDC: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d',
        CAKE: '0x0E09FaBB73Bd3Ade0a17ECC321fD13a19e81cE82',
        ETH: '0x2170Ed0880ac9A755fd29B2688956BD959F933F8',
        BTCB: '0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c'
      },
      ethereum: {
        WETH: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
        USDC: '0xA0b86a33E6441BCC9e7B7BAF956C23E02Bd6Bc3F',
        USDT: '0xdAC17F958D2ee523a2206206994597C13D831ec7',
        DAI: '0x6B175474E89094C44Da98b954EedeAC495271d0F',
        WBTC: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599',
        UNI: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984'
      }
    };
    
    // Router ABI (simplified)
    this.routerABI = [
      {
        inputs: [
          { name: 'amountIn', type: 'uint256' },
          { name: 'amountOutMin', type: 'uint256' },
          { name: 'path', type: 'address[]' },
          { name: 'to', type: 'address' },
          { name: 'deadline', type: 'uint256' }
        ],
        name: 'swapExactTokensForTokens',
        outputs: [{ name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'nonpayable',
        type: 'function'
      },
      {
        inputs: [
          { name: 'amountOut', type: 'uint256' },
          { name: 'path', type: 'address[]' }
        ],
        name: 'getAmountsOut',
        outputs: [{ name: 'amounts', type: 'uint256[]' }],
        stateMutability: 'view',
        type: 'function'
      }
    ];
    
    // Quoter ABI for V3
    this.quoterABI = [
      {
        inputs: [
          { name: 'tokenIn', type: 'address' },
          { name: 'tokenOut', type: 'address' },
          { name: 'fee', type: 'uint24' },
          { name: 'amountIn', type: 'uint256' },
          { name: 'sqrtPriceLimitX96', type: 'uint160' }
        ],
        name: 'quoteExactInputSingle',
        outputs: [{ name: 'amountOut', type: 'uint256' }],
        stateMutability: 'nonpayable',
        type: 'function'
      }
    ];
  }

  /**
   * Initialize DEX integration
   */
  async initialize(enabledDexes = ['pancakeswap']) {
    logger.info('Initializing DEX Integration...');
    
    for (const dexName of enabledDexes) {
      try {
        const config = this.dexConfigs[dexName];
        if (!config) {
          logger.warn(`Unknown DEX: ${dexName}`);
          continue;
        }
        
        // Initialize Web3
        const web3 = new Web3(config.rpcUrl);
        
        // Initialize router contract
        const router = new web3.eth.Contract(this.routerABI, config.router);
        
        // Initialize quoter for V3
        let quoter = null;
        if (config.quoter) {
          quoter = new web3.eth.Contract(this.quoterABI, config.quoter);
        }
        
        this.dexes.set(dexName, {
          config,
          web3,
          router,
          quoter,
          tokens: this.tokenAddresses[config.chain] || {}
        });
        
        logger.info(`DEX initialized: ${config.name}`);
      } catch (error) {
        logger.error(`Failed to initialize ${dexName}:`, error.message);
      }
    }
    
    this.isInitialized = true;
    logger.info(`DEX Integration initialized with ${this.dexes.size} DEXes`);
  }

  /**
   * Get price quote for a swap
   */
  async getQuote(dexName, tokenIn, tokenOut, amountIn, feeTier = 3000) {
    try {
      const dex = this.dexes.get(dexName);
      if (!dex) throw new Error(`DEX ${dexName} not initialized`);
      
      const { router, quoter, web3, tokens } = dex;
      
      // Resolve token addresses
      const tokenInAddress = tokens[tokenIn] || tokenIn;
      const tokenOutAddress = tokens[tokenOut] || tokenOut;
      
      // Convert amount to wei
      const amountInWei = web3.utils.toWei(amountIn.toString(), 'ether');
      
      let amountOut;
      
      if (quoter) {
        // V3 quoter
        amountOut = await quoter.methods.quoteExactInputSingle(
          tokenInAddress,
          tokenOutAddress,
          feeTier,
          amountInWei,
          0
        ).call();
      } else {
        // V2 router
        const amounts = await router.methods.getAmountsOut(
          amountInWei,
          [tokenInAddress, tokenOutAddress]
        ).call();
        amountOut = amounts[1];
      }
      
      const amountOutFormatted = web3.utils.fromWei(amountOut, 'ether');
      const price = parseFloat(amountOutFormatted) / amountIn;
      
      return {
        dex: dexName,
        tokenIn,
        tokenOut,
        amountIn,
        amountOut: amountOutFormatted,
        price,
        feeTier,
        timestamp: new Date()
      };
      
    } catch (error) {
      logger.error(`Failed to get quote from ${dexName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get best price across all DEXes
   */
  async getBestPrice(tokenIn, tokenOut, amountIn) {
    const quotes = [];
    
    for (const [dexName] of this.dexes) {
      try {
        const quote = await this.getQuote(dexName, tokenIn, tokenOut, amountIn);
        quotes.push(quote);
      } catch (error) {
        // Skip failed quotes
      }
    }
    
    if (quotes.length === 0) {
      throw new Error('No valid quotes received');
    }
    
    // Find best quote (highest amount out)
    const bestQuote = quotes.reduce((best, current) => 
      parseFloat(current.amountOut) > parseFloat(best.amountOut) ? current : best
    );
    
    return {
      bestQuote,
      allQuotes: quotes,
      savings: this.calculateSavings(quotes)
    };
  }

  /**
   * Calculate savings from using best DEX
   */
  calculateSavings(quotes) {
    const amounts = quotes.map(q => parseFloat(q.amountOut));
    const best = Math.max(...amounts);
    const worst = Math.min(...amounts);
    
    return {
      amount: (best - worst).toFixed(6),
      percentage: ((best - worst) / worst * 100).toFixed(2),
      bestDex: quotes.find(q => parseFloat(q.amountOut) === best)?.dex,
      worstDex: quotes.find(q => parseFloat(q.amountOut) === worst)?.dex
    };
  }

  /**
   * Execute swap (requires private key)
   */
  async executeSwap(dexName, tokenIn, tokenOut, amountIn, slippage = 0.5, walletConfig) {
    try {
      const dex = this.dexes.get(dexName);
      if (!dex) throw new Error(`DEX ${dexName} not initialized`);
      
      const { router, web3, tokens, config } = dex;
      
      // Get quote first
      const quote = await this.getQuote(dexName, tokenIn, tokenOut, amountIn);
      
      // Calculate minimum output with slippage
      const amountOutMin = parseFloat(quote.amountOut) * (1 - slippage / 100);
      const amountOutMinWei = web3.utils.toWei(amountOutMin.toString(), 'ether');
      
      // Build transaction
      const tokenInAddress = tokens[tokenIn] || tokenIn;
      const tokenOutAddress = tokens[tokenOut] || tokenOut;
      const amountInWei = web3.utils.toWei(amountIn.toString(), 'ether');
      
      const deadline = Math.floor(Date.now() / 1000) + 300; // 5 minutes
      
      const tx = router.methods.swapExactTokensForTokens(
        amountInWei,
        amountOutMinWei,
        [tokenInAddress, tokenOutAddress],
        walletConfig.address,
        deadline
      );
      
      // Estimate gas
      const gas = await tx.estimateGas({ from: walletConfig.address });
      
      // Get gas price
      const gasPrice = await web3.eth.getGasPrice();
      
      // Sign and send transaction
      const signedTx = await web3.eth.accounts.signTransaction(
        {
          to: config.router,
          data: tx.encodeABI(),
          gas,
          gasPrice,
          chainId: config.chainId
        },
        walletConfig.privateKey
      );
      
      const receipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
      
      return {
        success: true,
        txHash: receipt.transactionHash,
        blockNumber: receipt.blockNumber,
        gasUsed: receipt.gasUsed,
        dex: dexName,
        tokenIn,
        tokenOut,
        amountIn,
        expectedOut: quote.amountOut
      };
      
    } catch (error) {
      logger.error(`Swap execution failed on ${dexName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get pool information
   */
  async getPoolInfo(dexName, tokenA, tokenB) {
    try {
      const dex = this.dexes.get(dexName);
      if (!dex) throw new Error(`DEX ${dexName} not initialized`);
      
      // This would query the factory contract for pool info
      // Simplified implementation
      
      return {
        dex: dexName,
        tokenA,
        tokenB,
        reserveA: 0,
        reserveB: 0,
        totalSupply: 0,
        feeTier: 3000,
        apr: 0,
        volume24h: 0,
        tvl: 0
      };
      
    } catch (error) {
      logger.error(`Failed to get pool info:`, error.message);
      throw error;
    }
  }

  /**
   * Get supported tokens for a DEX
   */
  getSupportedTokens(dexName) {
    const dex = this.dexes.get(dexName);
    return dex ? Object.keys(dex.tokens) : [];
  }

  /**
   * Get all supported DEXes
   */
  getSupportedDEXes() {
    return Array.from(this.dexes.keys());
  }

  /**
   * Get DEX statistics
   */
  getStats() {
    return {
      initialized: this.isInitialized,
      dexes: Array.from(this.dexes.entries()).map(([name, dex]) => ({
        name,
        chain: dex.config.chain,
        tokens: Object.keys(dex.tokens).length
      }))
    };
  }
}

export const dexIntegration = new DEXIntegration();
