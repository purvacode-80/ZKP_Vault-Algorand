import * as algosdk from 'algosdk';
import { SessionData } from './ai-proctor-service';
import { PeraWalletConnect } from '@perawallet/connect';

// Algorand configuration
const ALGOD_TOKEN = '';
const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';
const ALGOD_PORT = 443;

export const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);

// Contract app ID (set after deployment)
let APP_ID = 755317770; // TODO: Replace with actual App ID after deployment

export function setAppId(appId: number) {
  APP_ID = appId;
}

export function getAppId(): number {
  return APP_ID;
}

/**
 * Submit proof to Algorand blockchain
 */
export async function submitProofToBlockchain(
  sessionData: SessionData,
  senderAddress: string,
  peraWallet: PeraWalletConnect
): Promise<string> {
  try {
    console.log('📤 Submitting proof to Algorand...');
    console.log('Sender address:', senderAddress);

    const suggestedParams = await algodClient.getTransactionParams().do();
    const encoder = new TextEncoder();

    const appArgs = [
      encoder.encode('submit_proof'),
      encoder.encode(sessionData.examId),
      encoder.encode(sessionData.studentHash),
      algosdk.encodeUint64(sessionData.trustScore),
      encoder.encode(sessionData.proofHash),
    ];

    // // ✅ Build the transaction with correct field names
    //   sconst txn = new algosdk.Transaction({
    //   sender: senderAddress,
    //   fee: suggestedParams.fee,
    //   firstValid: suggestedParams.firstRound,   // note: property firstValid, value from firstRound
    //   lastValid: suggestedParams.lastRound,     // note: property lastValid, value from lastRound
    //   genesisID: suggestedParams.genesisID,
    //   genesisHash: suggestedParams.genesisHash,
    //   type: algosdk.TransactionType.appl,       // use the enum, not the string "appl"
    //   appIndex: APP_ID,
    //   appOnComplete: 0,                          // NoOp
    //   appArgs: appArgs,
    // });

    // Sign the transaction
    const signedTxns = await peraWallet.signTransaction([txn]);

    // Submit
    const response = await algodClient.sendRawTransaction(signedTxns).do();
    const txid = response.txid;

    // Wait for confirmation
    await algosdk.waitForConfirmation(algodClient, txid, 3);

    console.log('✅ Proof submitted! Transaction ID:', txid);
    return txid;
  } catch (error) {
    console.error('❌ Failed to submit proof:', error);
    throw error;
  }
}

export async function getAccountInfo(address: string): Promise<any> {
  try {
    return await algodClient.accountInformation(address).do();
  } catch (error) {
    console.error('Failed to get account info:', error);
    throw error;
  }
}

export function formatAlgoAmount(microAlgos: number): string {
  return (microAlgos / 1_000_000).toFixed(6);
}

export async function estimateTransactionFee(): Promise<number> {
  try {
    const suggestedParams = await algodClient.getTransactionParams().do();
    return Number(suggestedParams.fee || suggestedParams.minFee);
  } catch (error) {
    console.error('Failed to estimate fee:', error);
    return 1000;
  }
}

// Mock functions (keep as is)
export async function getExamProofs(examId: string): Promise<any[]> {
  console.log('Getting proofs for exam:', examId);
  return [];
}

export async function getExamMetadata(examId: string): Promise<any> {
  return {
    examId,
    startTime: Date.now(),
    endTime: Date.now() + 3600000,
    isActive: true,
  };
}

export async function createExam(
  examId: string,
  durationMinutes: number,
  minTrustScore: number,
  creatorAddress: string,
  signerFunction: (txns: algosdk.Transaction[]) => Promise<Uint8Array[]>
): Promise<string> {
  console.log('Creating exam:', examId);
  return 'mock-tx-id';
}

export async function verifyProofExists(
  examId: string,
  studentHash: string,
  callerAddress: string
): Promise<boolean> {
  return false;
}

export interface ProofSubmissionResult {
  txId: string;
  explorerUrl: string;
  confirmationRound: number;
}

export interface ExamCreationResult {
  txId: string;
  explorerUrl: string;
  examId: string;
}
