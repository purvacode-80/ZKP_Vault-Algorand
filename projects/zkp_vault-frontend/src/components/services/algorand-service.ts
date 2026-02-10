// Algorand Service - Handles blockchain interactions
import algosdk from 'algosdk';
import { SessionData } from './ai-proctor-service';

// Algorand configuration
const ALGOD_TOKEN = ''; // For local sandbox or public node
const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';
const ALGOD_PORT = 443;

// Initialize Algod client
export const algodClient = new algosdk.Algodv2(ALGOD_TOKEN, ALGOD_SERVER, ALGOD_PORT);

// Contract app ID (set after deployment)
let APP_ID = 0; // Will be set after contract deployment

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
  signerFunction: (txns: algosdk.Transaction[]) => Promise<Uint8Array[]>
): Promise<string> {
  try {
    console.log('📤 Submitting proof to Algorand...');

    // Get suggested transaction parameters
    const suggestedParams = await algodClient.getTransactionParams().do();

    // Create application call transaction
    const appArgs = [
      new Uint8Array(Buffer.from('submit_proof')),
      new Uint8Array(Buffer.from(sessionData.examId)),
      new Uint8Array(Buffer.from(sessionData.studentHash)),
      algosdk.encodeUint64(sessionData.trustScore),
      new Uint8Array(Buffer.from(sessionData.proofHash)),
    ];

    const txn = algosdk.makeApplicationNoOpTxnFromObject({
      from: senderAddress,
      appIndex: APP_ID,
      appArgs,
      suggestedParams,
    });

    // Sign transaction
    const signedTxns = await signerFunction([txn]);

    // Submit transaction
    const { txId } = await algodClient.sendRawTransaction(signedTxns).do();

    // Wait for confirmation
    const confirmation = await waitForConfirmation(txId);

    console.log('✅ Proof submitted! Transaction ID:', txId);
    return txId;
  } catch (error) {
    console.error('❌ Failed to submit proof:', error);
    throw error;
  }
}

/**
 * Create a new exam on blockchain
 */
export async function createExam(
  examId: string,
  durationMinutes: number,
  minTrustScore: number,
  creatorAddress: string,
  signerFunction: (txns: algosdk.Transaction[]) => Promise<Uint8Array[]>
): Promise<string> {
  try {
    console.log('📝 Creating exam on Algorand...');

    const suggestedParams = await algodClient.getTransactionParams().do();

    const appArgs = [
      new Uint8Array(Buffer.from('create_exam')),
      new Uint8Array(Buffer.from(examId)),
      algosdk.encodeUint64(durationMinutes),
      algosdk.encodeUint64(minTrustScore),
    ];

    const txn = algosdk.makeApplicationNoOpTxnFromObject({
      from: creatorAddress,
      appIndex: APP_ID,
      appArgs,
      suggestedParams,
    });

    const signedTxns = await signerFunction([txn]);
    const { txId } = await algodClient.sendRawTransaction(signedTxns).do();

    await waitForConfirmation(txId);

    console.log('✅ Exam created! Transaction ID:', txId);
    return txId;
  } catch (error) {
    console.error('❌ Failed to create exam:', error);
    throw error;
  }
}

/**
 * Get proof from blockchain
 */
export async function getProof(
  examId: string,
  studentHash: string
): Promise<any> {
  try {
    console.log('🔍 Fetching proof from Algorand...');

    // Read from box storage
    const boxName = new Uint8Array(Buffer.from(`${examId}_${studentHash}`));
    const boxValue = await algodClient.getApplicationBoxByName(APP_ID, boxName).do();

    // Decode proof data
    // Note: You'll need to implement proper ABI decoding based on your struct
    return boxValue;
  } catch (error) {
    console.error('❌ Failed to fetch proof:', error);
    throw error;
  }
}

/**
 * Get exam metadata from blockchain
 */
export async function getExamMetadata(examId: string): Promise<any> {
  try {
    console.log('🔍 Fetching exam metadata...');

    const boxName = new Uint8Array(Buffer.from(examId));
    const boxValue = await algodClient.getApplicationBoxByName(APP_ID, boxName).do();

    return boxValue;
  } catch (error) {
    console.error('❌ Failed to fetch exam metadata:', error);
    throw error;
  }
}

/**
 * Verify if proof exists for a student
 */
export async function verifyProofExists(
  examId: string,
  studentHash: string,
  callerAddress: string
): Promise<boolean> {
  try {
    const suggestedParams = await algodClient.getTransactionParams().do();

    const appArgs = [
      new Uint8Array(Buffer.from('verify_proof_exists')),
      new Uint8Array(Buffer.from(examId)),
      new Uint8Array(Buffer.from(studentHash)),
    ];

    // This is a read-only call, so we won't actually send it
    // Instead, we'll try to read the box directly
    const boxName = new Uint8Array(Buffer.from(`${examId}_${studentHash}`));

    try {
      await algodClient.getApplicationBoxByName(APP_ID, boxName).do();
      return true;
    } catch {
      return false;
    }
  } catch (error) {
    console.error('Error checking proof existence:', error);
    return false;
  }
}

/**
 * Get all proofs for an exam (admin view)
 */
export async function getExamProofs(examId: string): Promise<any[]> {
  try {
    console.log('🔍 Fetching all proofs for exam:', examId);

    // Get all boxes for the application
    const boxes = await algodClient.getApplicationBoxes(APP_ID).do();

    // Filter boxes that start with examId
    const examProofs = boxes.boxes
      .filter((box: any) => {
        const boxName = Buffer.from(box.name).toString();
        return boxName.startsWith(`${examId}_`);
      })
      .map(async (box: any) => {
        const boxValue = await algodClient.getApplicationBoxByName(APP_ID, box.name).do();
        return {
          boxName: Buffer.from(box.name).toString(),
          value: boxValue,
        };
      });

    return Promise.all(examProofs);
  } catch (error) {
    console.error('❌ Failed to fetch exam proofs:', error);
    throw error;
  }
}

/**
 * Wait for transaction confirmation
 */
async function waitForConfirmation(txId: string, timeout: number = 10): Promise<any> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeout * 1000) {
    try {
      const pendingInfo = await algodClient.pendingTransactionInformation(txId).do();

      if (pendingInfo['confirmed-round'] !== null && pendingInfo['confirmed-round'] > 0) {
        return pendingInfo;
      }

      if (pendingInfo['pool-error'] != null && pendingInfo['pool-error'].length > 0) {
        throw new Error(`Transaction rejected: ${pendingInfo['pool-error']}`);
      }

      await new Promise(resolve => setTimeout(resolve, 1000));
    } catch (error) {
      throw error;
    }
  }

  throw new Error('Transaction confirmation timeout');
}

/**
 * Get Algorand Explorer URL for a transaction
 */
export function getExplorerUrl(txId: string, network: 'testnet' | 'mainnet' = 'testnet'): string {
  const baseUrl = network === 'mainnet'
    ? 'https://algoexplorer.io/tx/'
    : 'https://testnet.algoexplorer.io/tx/';

  return `${baseUrl}${txId}`;
}

/**
 * Get account information
 */
export async function getAccountInfo(address: string): Promise<any> {
  try {
    const accountInfo = await algodClient.accountInformation(address).do();
    return accountInfo;
  } catch (error) {
    console.error('Failed to get account info:', error);
    throw error;
  }
}

/**
 * Format ALGO amount (microAlgos to Algos)
 */
export function formatAlgoAmount(microAlgos: number): string {
  return (microAlgos / 1_000_000).toFixed(6);
}

/**
 * Estimate transaction fee
 */
export async function estimateTransactionFee(): Promise<number> {
  try {
    const suggestedParams = await algodClient.getTransactionParams().do();
    return suggestedParams.fee || suggestedParams.minFee;
  } catch (error) {
    console.error('Failed to estimate fee:', error);
    return 1000; // Default minimum fee
  }
}

// Export types
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
