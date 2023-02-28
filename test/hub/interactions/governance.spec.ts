import '@nomiclabs/hardhat-ethers';
import { expect } from 'chai';
import { ERRORS } from '../../helpers/errors';
import { governance, rejig, makeSuiteCleanRoom, userAddress } from '../../__setup.spec';

makeSuiteCleanRoom('Governance Functions', function () {
  context('Negatives', function () {
    it('User should not be able to call governance functions', async function () {
      await expect(rejig.setGovernance(userAddress)).to.be.revertedWith(ERRORS.NOT_GOVERNANCE);
    });
  });

  context('Scenarios', function () {
    it('Governance should successfully change the governance address', async function () {
      await expect(rejig.connect(governance).setGovernance(userAddress)).to.not.be.reverted;
    });
  });
});
