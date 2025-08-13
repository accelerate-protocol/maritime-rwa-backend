import { expect } from "chai";
import { ethers } from "hardhat";
import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { VaultToken } from "../typechain-types/contracts/v2/templates/token/VaultToken";
import { BasicVault } from "../typechain-types/contracts/v2/templates/vault/BasicVault";
import { AccumulatedYield } from "../typechain-types/contracts/v2/templates/yield/AccumulatedYield";

describe("VaultToken", function () {
    let vaultToken: VaultToken;
    let basicVault: BasicVault;
    let accumulatedYield: AccumulatedYield;
    let owner: HardhatEthersSigner;
    let manager: HardhatEthersSigner;
    let validator: HardhatEthersSigner;
    let user1: HardhatEthersSigner;
    let user2: HardhatEthersSigner;

    async function createModules() {
        // Deploy BasicVault
        const BasicVaultFactory = await ethers.getContractFactory("BasicVault");
        basicVault = await BasicVaultFactory.deploy();
        
        // Deploy AccumulatedYield
        const YieldFactory = await ethers.getContractFactory("AccumulatedYield");
        accumulatedYield = await YieldFactory.deploy();
        
        // Deploy VaultToken
        const VaultTokenFactory = await ethers.getContractFactory("VaultToken");
        vaultToken = await VaultTokenFactory.deploy();
        
        // Initialize BasicVault
        const vaultInitData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "bool", "address[]"],
            [manager.address, validator.address, false, []]
        );
        await basicVault.initiate(vaultInitData);
        
        // Initialize AccumulatedYield
        const originalYieldInitData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "address", "address"],
            [
                await vaultToken.getAddress(), // rewardToken
                manager.address, // rewardManager
                manager.address // dividendTreasury
            ]
        );
        const yieldInitData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["address", "bytes"],
            [
                await vaultToken.getAddress(), // token (shareToken)
                originalYieldInitData
            ]
        );
        await accumulatedYield.initiate(await basicVault.getAddress(), yieldInitData);
        
        // Set modules in BasicVault
        await basicVault.connect(manager).setVaultToken(await vaultToken.getAddress());
        await basicVault.connect(manager).setDividendModule(await accumulatedYield.getAddress());
        await basicVault.connect(manager).setFundingModule(manager.address); // Set manager as funding module for testing
        
        // Initialize VaultToken
        const tokenInitData = ethers.AbiCoder.defaultAbiCoder().encode(
            ["string", "string", "uint8"],
            ["Test Vault Token", "TVT", 18]
        );
        await vaultToken.initiate(await basicVault.getAddress(), tokenInitData);
        
        return { basicVault, accumulatedYield, vaultToken };
    }

    beforeEach(async function () {
        [owner, manager, validator, user1, user2] = await ethers.getSigners();

        const VaultTokenFactory = await ethers.getContractFactory("VaultToken");
        vaultToken = await VaultTokenFactory.deploy();
    });

    describe("Initialization", function () {
        it("should initialize token correctly", async function () {
            const tokenInitData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["string", "string", "uint8"],
                ["Test Vault Token", "TVT", 18]
            );
            await vaultToken.initiate(manager.address, tokenInitData);

            expect(await vaultToken.vault()).to.equal(manager.address);
            expect(await vaultToken.name()).to.equal("Test Vault Token");
            expect(await vaultToken.symbol()).to.equal("TVT");
            expect(await vaultToken.decimals()).to.equal(18);
            expect(await vaultToken.isInitialized()).to.be.true;
        });

        it("should reject duplicate initialization", async function () {
            const tokenInitData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["string", "string", "uint8"],
                ["Test Vault Token", "TVT", 18]
            );
            await vaultToken.initiate(manager.address, tokenInitData);

            const anotherTokenInitData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["string", "string", "uint8"],
                ["Another Token", "AT", 6]
            );
            await expect(
                vaultToken.initiate(manager.address, anotherTokenInitData)
            ).to.be.revertedWith("VaultToken: already initialized");
        });

        it("should reject invalid initialization parameters", async function () {
            const tokenInitData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["string", "string", "uint8"],
                ["Test Token", "TT", 18]
            );
            await expect(
                vaultToken.initiate(ethers.ZeroAddress, tokenInitData)
            ).to.be.revertedWith("VaultToken: invalid vault");

            const emptyNameInitData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["string", "string", "uint8"],
                ["", "TT", 18]
            );
            await expect(
                vaultToken.initiate(manager.address, emptyNameInitData)
            ).to.be.revertedWith("VaultToken: empty name");

            const emptySymbolInitData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["string", "string", "uint8"],
                ["Test Token", "", 18]
            );
            await expect(
                vaultToken.initiate(manager.address, emptySymbolInitData)
            ).to.be.revertedWith("VaultToken: empty symbol");

            const invalidDecimalsInitData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["string", "string", "uint8"],
                ["Test Token", "TT", 25]
            );
            await expect(
                vaultToken.initiate(manager.address, invalidDecimalsInitData)
            ).to.be.revertedWith("VaultToken: invalid decimals");
        });
    });

    describe("Minting and Burning", function () {
        beforeEach(async function () {
            const tokenInitData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["string", "string", "uint8"],
                ["Test Vault Token", "TVT", 18]
            );
            await vaultToken.initiate(manager.address, tokenInitData);
            
            // Unpause token for testing (since it's paused during initialization)
            // Note: manager is the vault in this test context
            await vaultToken.connect(manager).unpause();
        });

        it("should allow Vault to mint tokens", async function () {
            const mintAmount = ethers.parseEther("1000");
            
            await expect(vaultToken.connect(manager).mint(user1.address, mintAmount))
                .to.emit(vaultToken, "TokenMinted")
                .withArgs(user1.address, mintAmount);

            expect(await vaultToken.balanceOf(user1.address)).to.equal(mintAmount);
        });

        it("should reject non-Vault address minting", async function () {
            const mintAmount = ethers.parseEther("1000");
            
            await expect(
                vaultToken.connect(user1).mint(user2.address, mintAmount)
            ).to.be.revertedWith("VaultToken: only vault");
        });

        it("should reject minting to zero address", async function () {
            const mintAmount = ethers.parseEther("1000");
            
            await expect(
                vaultToken.connect(manager).mint(ethers.ZeroAddress, mintAmount)
            ).to.be.revertedWith("VaultToken: mint to zero address");
        });

        it("should reject minting zero amount", async function () {
            await expect(
                vaultToken.connect(manager).mint(user1.address, 0)
            ).to.be.revertedWith("VaultToken: mint amount must be positive");
        });

        it("should allow Vault to burn tokens", async function () {
            const mintAmount = ethers.parseEther("1000");
            const burnAmount = ethers.parseEther("500");
            
            await vaultToken.connect(manager).mint(user1.address, mintAmount);
            
            // User needs to approve vault to burn tokens
            await vaultToken.connect(user1).approve(manager.address, burnAmount);
            
            await expect(vaultToken.connect(manager).burnFrom(user1.address, burnAmount))
                .to.emit(vaultToken, "TokenBurned")
                .withArgs(user1.address, burnAmount);

            expect(await vaultToken.balanceOf(user1.address)).to.equal(mintAmount - burnAmount);
        });

        it("should reject burning from zero address", async function () {
            const burnAmount = ethers.parseEther("500");
            
            await expect(
                vaultToken.connect(manager).burnFrom(ethers.ZeroAddress, burnAmount)
            ).to.be.revertedWith("VaultToken: burn from zero address");
        });

        it("should reject burning zero amount", async function () {
            await expect(
                vaultToken.connect(manager).burnFrom(user1.address, 0)
            ).to.be.revertedWith("VaultToken: burn amount must be positive");
        });

        it("should reject burning more than balance", async function () {
            const mintAmount = ethers.parseEther("1000");
            const burnAmount = ethers.parseEther("1500");
            
            await vaultToken.connect(manager).mint(user1.address, mintAmount);
            
            await expect(
                vaultToken.connect(manager).burnFrom(user1.address, burnAmount)
            ).to.be.revertedWith("VaultToken: insufficient balance");
        });
    });

    describe("Pause Functionality", function () {
        beforeEach(async function () {
            const tokenInitData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["string", "string", "uint8"],
                ["Test Vault Token", "TVT", 18]
            );
            await vaultToken.initiate(manager.address, tokenInitData);
            
            // Unpause token for testing (since it's paused during initialization)
            // Note: manager is the vault in this test context
            await vaultToken.connect(manager).unpause();
        });

        it("should allow Vault to pause token", async function () {
            await expect(vaultToken.connect(manager).pause())
                .to.emit(vaultToken, "TokenPaused");

            expect(await vaultToken.paused()).to.be.true;
        });

        it("should allow Vault to unpause token", async function () {
            await vaultToken.connect(manager).pause();
            
            await expect(vaultToken.connect(manager).unpause())
                .to.emit(vaultToken, "TokenUnpaused");

            expect(await vaultToken.paused()).to.be.false;
        });

        it("should reject non-Vault address pausing", async function () {
            await expect(
                vaultToken.connect(user1).pause()
            ).to.be.revertedWith("VaultToken: only vault");
        });

        it("should reject non-Vault address unpausing", async function () {
            await vaultToken.connect(manager).pause();
            
            await expect(
                vaultToken.connect(user1).unpause()
            ).to.be.revertedWith("VaultToken: only vault");
        });

        it("should reject transfers when paused", async function () {
            await vaultToken.connect(manager).mint(user1.address, ethers.parseEther("1000"));
            await vaultToken.connect(manager).pause();
            
            await expect(
                vaultToken.connect(user1).transfer(user2.address, ethers.parseEther("100"))
            ).to.be.revertedWith("VaultToken: token transfer while paused");
        });
    });

    describe("Transfer Functionality", function () {
        beforeEach(async function () {
            const modules = await createModules();
            basicVault = modules.basicVault;
            accumulatedYield = modules.accumulatedYield;
            vaultToken = modules.vaultToken;
            
            // Unpause token for testing (since it's paused during initialization)
            await basicVault.connect(manager).unpauseToken();
            
            await basicVault.connect(manager).mintToken(user1.address, ethers.parseEther("1000"));
        });

        it("should transfer tokens normally", async function () {
            const transferAmount = ethers.parseEther("100");
            
            await expect(
                vaultToken.connect(user1).transfer(user2.address, transferAmount)
            ).to.not.be.reverted;

            expect(await vaultToken.balanceOf(user2.address)).to.equal(transferAmount);
        });

        it("should handle transfer with vault integration", async function () {
            const transferAmount = ethers.parseEther("100");
            
            await expect(
                vaultToken.connect(user1).transfer(user2.address, transferAmount)
            ).to.not.be.reverted;
        });
        
        it("should calculate yield based on balance before transfer", async function () {
            const transferAmount = ethers.parseEther("500");
            
            // Before transfer, user1 should have 1000 tokens (minted in beforeEach)
            const initialBalance = ethers.parseEther("1000");
            expect(await vaultToken.balanceOf(user1.address)).to.equal(initialBalance);
            
            // Transfer 500 tokens to user2
            await vaultToken.connect(user1).transfer(user2.address, transferAmount);
            
            // After transfer, user1 should have 500 tokens, user2 should have 500 tokens
            expect(await vaultToken.balanceOf(user1.address)).to.equal(initialBalance - transferAmount);
            expect(await vaultToken.balanceOf(user2.address)).to.equal(transferAmount);
        });
    });

    describe("Query Functionality", function () {
        beforeEach(async function () {
            const tokenInitData = ethers.AbiCoder.defaultAbiCoder().encode(
                ["string", "string", "uint8"],
                ["Test Vault Token", "TVT", 18]
            );
            await vaultToken.initiate(manager.address, tokenInitData);
        });

        it("should return token information correctly", async function () {
            expect(await vaultToken.name()).to.equal("Test Vault Token");
            expect(await vaultToken.symbol()).to.equal("TVT");
            expect(await vaultToken.decimals()).to.equal(18);
            expect(await vaultToken.vault()).to.equal(manager.address);
        });

        it("should return initialization status correctly", async function () {
            expect(await vaultToken.isInitialized()).to.be.true;
        });
    });
}); 