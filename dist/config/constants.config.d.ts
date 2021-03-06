/// <reference types="node" />
import { AccountId, ContractId, TokenId } from '@hashgraph/sdk';
export declare const CONFIRMATION_STATUS = 1;
export declare const EXIT_STATUS = -1;
export declare const HEDERA_SUCCESS = 22;
export declare const TOKEN_ID = "0.0.47717582";
export declare const TLD_MANAGER_ID = "0.0.47717584";
export declare const MAX_GAS = 4000000;
declare type Network = 'testnet' | 'mainnet';
export declare const NETWORK: Network;
export declare const NULL_CONTRACT_ADDRESS: string;
export declare const NULL_CONTRACT_ID: ContractId;
export declare const NULL_ACCOUNT_ID: AccountId;
export declare enum ContractTypes {
    SLDNode = 0,
    TLDManager = 1,
    TLDNode = 2,
    SubdomainNode = 3
}
export declare type ContractType = ContractTypes.SLDNode | ContractTypes.SubdomainNode | ContractTypes.TLDManager | ContractTypes.TLDNode;
export interface ContractInfo {
    id: ContractId;
    abi: string;
}
export interface NameHash {
    domain: string;
    tldHash: Buffer;
    sldHash: Buffer;
    subdomainHash: Buffer;
}
export interface NFTMetadata {
    name: string;
    creator: string;
}
export interface Addresses {
    eth: string;
    btc: string;
    sol: string;
}
export interface TextRecord {
    avatar: string;
    twitter: string;
    email: string;
    url: string;
    description: string;
    notice: string;
    keywords: string;
    discord: string;
    github: string;
    reddit: string;
    telegram: string;
}
export interface SLDInfo {
    serial: number;
    expiry: number;
    subdomainNode: string;
    index: number;
    addresses: Addresses;
    textRecord: TextRecord;
}
export interface SubdomainInfo {
    owner: string;
    name: string;
    addresses: Addresses;
    textRecord: TextRecord;
}
export interface NFTData {
    accountId: AccountId;
    metadata: string;
    serialNumber: number;
    tokenId: TokenId;
}
export {};
