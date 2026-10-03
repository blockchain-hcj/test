import React, { useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { createConfig, createConnector, http, WagmiProvider, useAccount, useSwitchChain } from 'wagmi';
import { injected } from 'wagmi/connectors';
import { getAccount } from 'wagmi/actions';
import { defineChain } from 'viem';
import { BrowserProvider } from 'ethers';
import { ConnectButton, RainbowKitProvider, connectorsForWallets, darkTheme, useConnectModal } from '@rainbow-me/rainbowkit';
import { okxWallet, metaMaskWallet, injectedWallet } from '@rainbow-me/rainbowkit/wallets';
import '@rainbow-me/rainbowkit/styles.css';
import { setWalletAdapter } from './app.js';

const arc = defineChain({
  id: 5042, name: 'Arc', nativeCurrency: { name: 'USDC', symbol: 'USDC', decimals: 18 },
  rpcUrls: { default: { http: ['https://rpc.blockdaemon.mainnet.arc.io'] } },
});

// Keep RainbowKit's wallet metadata/install flow, using extension connectors only.
// No WalletConnect project id is needed for this desktop extension workflow.
function extensionWallet(factory, provider) {
  return () => {
    const wallet = factory({ projectId: '' });
    return {
      ...wallet,
      createConnector: (details) => createConnector((config) => ({
        ...injected({ target: () => ({ id: wallet.id, name: wallet.name, provider: provider() }) })(config),
        ...details,
      })),
      mobile: undefined, qrCode: undefined,
    };
  };
}
const okxExtension = extensionWallet(okxWallet, () => window.okxwallet ||
  window.ethereum?.providers?.find(p => p.isOkxWallet || p.isOKXWallet) ||
  (window.ethereum?.isOkxWallet || window.ethereum?.isOKXWallet ? window.ethereum : undefined));
const metamaskExtension = extensionWallet(metaMaskWallet, () =>
  window.ethereum?.providers?.find(p => p.isMetaMask && !p.isOkxWallet) ||
  (window.ethereum?.isMetaMask && !window.ethereum?.isOkxWallet ? window.ethereum : undefined));
const config = createConfig({
  storage: null,
  chains: [arc], transports: { [arc.id]: http() },
  connectors: connectorsForWallets([{ groupName: '浏览器钱包', wallets: [okxExtension, metamaskExtension, injectedWallet] }], { appName: '测试池费率管理', projectId: '' }),
});
const queryClient = new QueryClient();

function WalletControl() {
  const account = useAccount();
  const { openConnectModal } = useConnectModal();
  const { switchChainAsync } = useSwitchChain();
  useEffect(() => {
    setWalletAdapter({
      connected: account.isConnected,
      openConnect: () => openConnectModal?.(),
      switchChain: () => switchChainAsync({ chainId: arc.id }),
      getSigner: async () => {
        const active = getAccount(config);
        if (!active.connector || !active.address) throw new Error('请先连接钱包');
        const provider = await active.connector.getProvider();
        return new BrowserProvider(provider).getSigner(active.address);
      },
    });
    const badge = document.getElementById('networkBadge');
    badge.textContent = account.isConnected ? (account.chainId === arc.id ? 'Arc 已连接' : '请切换到 Arc') : '目标网络 Arc';
    badge.className = `badge ${account.chainId === arc.id && account.isConnected ? 'ok' : 'muted'}`;
    document.getElementById('walletAvailability').textContent = account.isConnected
      ? `${account.connector?.name || '钱包'} · ${account.address || '账户读取中'} · Chain ${account.chainId ?? '读取中'}。点击右上角账户可断开；切换插件账户后页面自动同步。`
      : '点击“连接钱包”，在弹窗选择 OKX 等浏览器钱包。更换钱包时先点账户断开，再重新连接。';
  }, [account.address, account.chainId, account.isConnected, account.connector, openConnectModal, switchChainAsync]);
  return <ConnectButton label="连接钱包" accountStatus="address" chainStatus="name" showBalance={false} />;
}

createRoot(document.getElementById('walletRoot')).render(
  <WagmiProvider config={config} reconnectOnMount={false}>
    <QueryClientProvider client={queryClient}>
      <RainbowKitProvider locale="zh-CN" theme={darkTheme({ accentColor: '#49d6bc', accentColorForeground: '#04201f', borderRadius: 'medium' })}>
        <WalletControl />
      </RainbowKitProvider>
    </QueryClientProvider>
  </WagmiProvider>,
);
