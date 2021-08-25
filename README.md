# H24 Smart Contract

## Deploy

1. Clone repository
2. Install dependencies `yarn install`
3. Create and fill .env file
   - `cp .env.example .env`
   - Copy your Project ID from https://infura.io/dashboard/ethereum to `INFURA_KEY`
   - Copy your ETH wallet Private Key to `PRIVATE_KEY`
4. Run `yarn test` 
5. Run `yarn deploy` to deploy contract on Rinkeby testnet
6. Run `yarn verify` to verify contract bytecode on etherscan
