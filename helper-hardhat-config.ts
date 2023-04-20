const networkConfig = {
    default: {
        name: "hardhat"
    },
    31337: {
        name: "localhost"
    },
    1: {
        name: "mainnet"
    },
}

const developmentChains = ["hardhat", "localhost"]
const VERIFICATION_BLOCK_CONFIRMATIONS = 6
const frontEndContractsFile = "../app/constants/contractAddresses.json"
const frontEndAbiFile = "../app/constants/abi.json"

export {
    networkConfig,
    developmentChains,
    VERIFICATION_BLOCK_CONFIRMATIONS,
    frontEndContractsFile,
    frontEndAbiFile
}
