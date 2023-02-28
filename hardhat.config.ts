import { HardhatUserConfig } from 'hardhat/types';
import dotenv from 'dotenv';
import glob from 'glob';
import path from 'path';
dotenv.config({ path: '../.env' });

import '@nomiclabs/hardhat-ethers';
import '@nomiclabs/hardhat-etherscan';
import '@typechain/hardhat';
import 'solidity-coverage';
import 'hardhat-gas-reporter';
import 'hardhat-contract-sizer';
import 'hardhat-log-remover';
import 'hardhat-spdx-license-identifier';

// if (!process.env.SKIP_LOAD) {
//   glob.sync('./tasks/**/*.ts').forEach(function (file) {
//     require(path.resolve(file));
//   });
// }

const COINMARKETCAP_API_KEY = process.env.COINMARKETCAP_API_KEY
const REPORT_GAS = process.env.REPORT_GAS || false

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: '0.8.10',
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
            details: {
              yul: true,
            },
          },
        },
      },
    ],
  },
  contractSizer: {
    runOnCompile: true,
  },
  defaultNetwork: "hardhat",
    networks: {
        hardhat: {
            chainId: 31337,
            allowUnlimitedContractSize: true
        },
        localhost: {
            chainId: 31337,
            allowUnlimitedContractSize: true
        }
    },
  gasReporter: {
      enabled: REPORT_GAS === 'true',
      currency: "USD",
      outputFile: "gas-report.txt",
      noColors: true,
      coinmarketcap: COINMARKETCAP_API_KEY,
  },
  spdxLicenseIdentifier: {
    overwrite: false,
    runOnCompile: false,
  },
  mocha: {
    timeout: 1000000, // 1000 seconds max for running tests
  },
};

export default config;
