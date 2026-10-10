// Public RPC endpoints shared by state reads and wallet network switching.
export const NETWORKS = {
  5042: {
    id: 5042, name: 'Arc',
    nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
    rpcUrls: { default: { http: ['https://rpc.blockdaemon.mainnet.arc.io'] } },
  },
  56: {
    id: 56, name: 'BSC',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: { default: { http: ['https://bsc-dataseed.bnbchain.org'] } },
    blockExplorers: { default: { name: 'BscScan', url: 'https://bscscan.com' } },
  },
};
