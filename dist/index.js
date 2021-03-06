import { AccountId, Client, ContractId, Hbar, NftId, PrivateKey, Status, TokenId, TokenNftInfoQuery, Transaction, TransferTransaction, } from '@hashgraph/sdk';
import keccak256 from 'keccak256';
import { CONFIRMATION_STATUS, NULL_CONTRACT_ID, TOKEN_ID, } from './config/constants.config';
import { callDumpNames, callGetNumNodes, callGetSerial, callGetSLDInfo, callGetSLDNode, callGetSubdomainInfo, callGetTLD, queryNFTsFromRestAPI, } from './contract.utils';
export class HashgraphNames {
    operatorId;
    operatorKey;
    client;
    tokenId = TokenId.fromString(TOKEN_ID);
    constructor(operatorId, operatorKey) {
        this.operatorId = AccountId.fromString(operatorId);
        this.operatorKey = PrivateKey.fromString(operatorKey);
        this.client = Client
            .forTestnet()
            .setOperator(this.operatorId, this.operatorKey);
    }
    static generateMetadata = (domain) => {
        const metadata = {
            name: domain,
            creator: 'piefi labs',
            // creatorDID: '',
            // description: 'Hashgraph Naming service domain',
            // image: '[cid or path to NFT\'s image]',
            // type: 'image/jpeg',
            // files: [],
            // format: 'none',
            // properties: [],
            // localization: [],
        };
        return metadata;
    };
    /**
   * @description Generate a NameHash of the provided domain string
   * @param domain: {string} The domain string to hash
   * @returns {Buffer}
   */
    static generateNameHash = (domain) => {
        if (!domain) {
            return {
                domain,
                tldHash: Buffer.from([0x0]),
                sldHash: Buffer.from([0x0]),
                subdomainHash: Buffer.from([0x0]),
            };
        }
        const domainsList = domain.split('.').reverse();
        const tld = domainsList[0];
        let sld;
        let subdomains;
        if (domainsList.length > 1) {
            sld = domainsList.slice(0, 2);
        }
        if (domainsList.length > 2) {
            subdomains = domainsList;
        }
        let tldHash = Buffer.from([0x0]);
        let sldHash = Buffer.from([0x0]);
        let subdomainHash = Buffer.from([0x0]);
        if (tld) {
            tldHash = keccak256(tld);
        }
        if (sld) {
            sldHash = sld.reduce((prev, curr) => keccak256(prev + curr), Buffer.from(''));
        }
        if (subdomains) {
            subdomainHash = subdomains.reduce((prev, curr) => keccak256(prev + curr), Buffer.from(''));
        }
        return { domain, tldHash, sldHash, subdomainHash };
    };
    /**
   * @description Query the registry for the SLDNode responsible for a domain
   * @param nameHash: {NameHash} The NameHash of the domain to query
   * @param tldNodeId: {ContractId} TLDNode contract id
   * @returns {Promise<ContractId>}
   */
    getSLDNode = async (nameHash, tldNodeId = NULL_CONTRACT_ID) => {
        try {
            let decodedResult = NULL_CONTRACT_ID;
            let tldId = tldNodeId;
            if (tldId === NULL_CONTRACT_ID) {
                tldId = await callGetTLD(this.client, nameHash.tldHash);
            }
            const numNodes = await callGetNumNodes(this.client, tldId);
            const chunkSize = 100;
            let begin = 0;
            let end = 0;
            for (let i = 0; end < numNodes; i += 1) {
                end = Number((i + 1) * chunkSize);
                // eslint-disable-next-line no-await-in-loop
                decodedResult = await callGetSLDNode(this.client, nameHash, tldId, begin, end);
                if (decodedResult !== NULL_CONTRACT_ID) {
                    // Found the owner
                    break;
                }
                begin = end;
            }
            return decodedResult;
        }
        catch (err) {
            throw new Error('Failed to get SLDNode');
        }
    };
    /**
   * @description Takes a nameHash and returns the SLD that contains it
   * @param nameHash: {Buffer} The nameHash of the domain to be queried
   * @returns {Promise<ContractId>}
   */
    resolveSLDNode = async (nameHash) => {
        try {
            const tldNodeId = await callGetTLD(this.client, nameHash.tldHash);
            if (String(tldNodeId) === String(NULL_CONTRACT_ID)) {
                throw new Error('Failed to getTLDNode');
            }
            const sldNodeId = await this.getSLDNode(nameHash, tldNodeId);
            if (String(sldNodeId) === String(NULL_CONTRACT_ID)) {
                throw new Error('Failed to getSLDNode');
            }
            return sldNodeId;
        }
        catch (err) {
            throw new Error('Failed to resolve SLD');
        }
    };
    /**
   * @description Resolves a Second Level Domain to the wallet address of the domain's owner
   * @param domain: {string} The domain to query
   * @returns {Promise<AccountId>}
   */
    resolveSLD = async (domain) => {
        try {
            const nameHash = HashgraphNames.generateNameHash(domain);
            const sldNodeId = await this.resolveSLDNode(nameHash);
            const serial = await callGetSerial(this.client, sldNodeId, nameHash);
            const { accountId } = await this.getTokenNFTInfo(serial);
            return accountId;
        }
        catch (err) {
            throw new Error('Failed to get wallet');
        }
    };
    /**
   * @description Get the SLDInfo for a given domain
   * @param domain: {string} The domain to query
   * @returns {Promise<SLDInfo>}
   */
    getSLDInfo = async (domain) => {
        try {
            const nameHash = HashgraphNames.generateNameHash(domain);
            const sldNodeId = await this.resolveSLDNode(nameHash);
            return await callGetSLDInfo(this.client, sldNodeId, nameHash);
        }
        catch (err) {
            throw new Error('Failed to get SLD Info');
        }
    };
    /**
   * @description Get the SubdomainInfo for a given domain
   * @param domain: {string} The domain to query
   * @returns {Promise<SubdomainInfo>}
   */
    getSubdomainInfo = async (domain) => {
        try {
            const nameHash = HashgraphNames.generateNameHash(domain);
            const sldNodeId = await this.resolveSLDNode(nameHash);
            const sldNodeInfo = await callGetSLDInfo(this.client, sldNodeId, nameHash);
            const subdomainNodeId = ContractId.fromSolidityAddress(sldNodeInfo.subdomainNode);
            return await callGetSubdomainInfo(this.client, subdomainNodeId, nameHash);
        }
        catch (err) {
            throw new Error('Failed to get SLD Info');
        }
    };
    /**
   * @description Get all subdomains for a given domain
   * @param domain: {string} The domain to query
   * @returns {Promise<string[]>}
   */
    getSLDSubdomains = async (domain) => {
        try {
            const nameHash = HashgraphNames.generateNameHash(domain);
            const sldNodeId = await this.resolveSLDNode(nameHash);
            const sldNodeInfo = await callGetSLDInfo(this.client, sldNodeId, nameHash);
            const subdomainNodeId = ContractId.fromSolidityAddress(sldNodeInfo.subdomainNode);
            return await callDumpNames(this.client, subdomainNodeId);
        }
        catch (err) {
            throw new Error('Failed to get SLD Info');
        }
    };
    getAllSLDsInWallet = async () => {
        try {
            return await queryNFTsFromRestAPI(this.client, this.tokenId);
        }
        catch (err) {
            throw new Error('Failed to get SLD Info');
        }
    };
    /**
   * @description Helper function to convert an Uint8Array into an Hedera Transaction type
   * @param transactionBytes: {Uint8Array} The transaction bytes to be converted
   */
    static bytesToTransaction = (transactionBytes) => {
        const uint8Array = new Uint8Array(transactionBytes);
        const transaction = Transaction.fromBytes(uint8Array);
        return transaction;
    };
    /**
   * @description Executes an HTS TransferTransaction
   * @param ownerSignature: {TransactionSignature} The signature information for the NFT owner
   * @param receiverSignature: {TransactionSignature} The signature information for the NFT receiver
   * @param transactionBytes: {Uint8Array} The transaction bytes to be executed
   * @returns {Promise<number>}
   */
    transferDomain = async (ownerSignature, receiverSignature, transactionBytes) => {
        try {
            const transaction = HashgraphNames.bytesToTransaction(transactionBytes);
            transaction
                .addSignature(ownerSignature.signerPublicKey, ownerSignature.signature)
                .addSignature(receiverSignature.signerPublicKey, receiverSignature.signature);
            const submitTransaction = await transaction.execute(this.client);
            const receipt = await submitTransaction.getReceipt(this.client);
            if (receipt.status._code !== Status.Success._code) {
                throw new Error('TransferTransaction failed');
            }
        }
        catch (err) {
            throw new Error('Transfer Domain failed');
        }
        return CONFIRMATION_STATUS;
    };
    /**
   * @description Signs a Hedera transaction
   * @param signerKey: {string} The private key with which to sign the transaction
   * @param transactionBytes: {Uint8Array} The bytes for the transaction to be signed
   * @returns {Promise<Uint8Array>}
   */
    static transferTransactionSign = (signerKey, transactionBytes) => {
        const transaction = HashgraphNames.bytesToTransaction(transactionBytes);
        const signerPVKey = PrivateKey.fromString(signerKey);
        const signature = signerPVKey.signTransaction(transaction);
        return { signerPublicKey: signerPVKey.publicKey, signature };
    };
    /**
   * @description Creates a HTS TransferTransaction and returns it as an Uint8Array
   * @param domain: {string} The domain for the NFT to transfer
   * @param NFTOwner: {string} The account id of the NFT owner
   * @param NFTReceiver: {string} The account id of the NFT receiver
   * @param purchasePrice: {number} The amount in tinyBar for which the NFT is being purchased
   * @returns {Uint8Array}
   */
    transferTransactionCreate = async (domain, NFTOwner, NFTReceiver, purchasePrice) => {
        try {
            const fromIdNFT = AccountId.fromString(NFTOwner);
            const toIdNFT = AccountId.fromString(NFTReceiver);
            const nameHash = HashgraphNames.generateNameHash(domain);
            const sldNodeId = await this.resolveSLDNode(nameHash);
            const serial = await callGetSerial(this.client, sldNodeId, nameHash);
            const nodeId = [new AccountId(3)];
            const tokenTransferTx = new TransferTransaction()
                .addNftTransfer(this.tokenId, serial, fromIdNFT, toIdNFT)
                .addHbarTransfer(toIdNFT, Hbar.fromTinybars(-1 * purchasePrice))
                .addHbarTransfer(fromIdNFT, Hbar.fromTinybars(purchasePrice))
                .setNodeAccountIds(nodeId)
                .freezeWith(this.client);
            return tokenTransferTx.toBytes();
        }
        catch (err) {
            throw new Error('MultiSig transaction create failed');
        }
    };
    /**
   * @description Simple wrapper around HTS TokenNftInfoQuery()
   * @param serial: {number} The serial of the NFT to query
   * @returns {Promise<TokenNftInfo>}
   */
    getTokenNFTInfo = async (serial) => {
        try {
            const nftId = new NftId(this.tokenId, serial);
            const nftInfo = await new TokenNftInfoQuery()
                .setNftId(nftId)
                .execute(this.client);
            return nftInfo[0];
        }
        catch (err) {
            throw new Error('Get NFT info failed');
        }
    };
}
