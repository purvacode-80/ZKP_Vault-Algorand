// Algorand Service - Handles blockchain interactions
import algosdk from 'algosdk';
import { SessionData } from './ai-proctor-service';

// Algorand configuration
const ALGOD_TOKEN = '';
const ALGOD_SERVER = 'https://testnet-api.algonode.cloud';
const ALGOD_PORT = 443;

// Initialize Algod client
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
  signerFunction: (txns: algosdk.Transaction[]) => Promise<Uint8Array[]>
): Promise<string> {
  try {
    console.log('📤 Submitting proof to Algorand...');

    // Get suggested transaction parameters
    const suggestedParams = await algodClient.getTransactionParams().do();

    // Encode application arguments
    const appArgs = [
      new Uint8Array(Buffer.from('submit_proof')),
      new Uint8Array(Buffer.from(sessionData.examId)),
      new Uint8Array(Buffer.from(sessionData.studentHash)),
      algosdk.encodeUint64(sessionData.trustScore),
      new Uint8Array(Buffer.from(sessionData.proofHash)),
    ];

    const account = algosdk.generateAccount();

    const txn = algosdk.makeApplicationNoOpTxnFromObject({
      sender: account.addr,
      appIndex: APP_ID,
      appArgs,
      suggestedParams,
    });


    // Sign transaction
    const signedTxns = await signerFunction([txn]);

    // Submit transaction
    const response = await algodClient.sendRawTransaction(signedTxns).do();
    const txId = response.txid;

    // Wait for confirmation
    await waitForConfirmation(txId);

    console.log('✅ Proof submitted! Transaction ID:', txId);
    return txId;
  } catch (error) {
    console.error('❌ Failed to submit proof:', error);
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

      const round = pendingInfo.confirmedRound ?? 0;
      if (round > 0) {
              return pendingInfo;
            }


      if (pendingInfo.poolError != null && pendingInfo.poolError.length > 0) {
        throw new Error(`Transaction rejected: ${pendingInfo.poolError}`);
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
    return Number(suggestedParams.fee || suggestedParams.minFee);
  } catch (error) {
    console.error('Failed to estimate fee:', error);
    return 1000; // Default minimum fee
  }
}

// Mock functions for demo (replace with actual implementation if needed)
export async function getExamProofs(examId: string): Promise<any[]> {
  console.log('Getting proofs for exam:', examId);
  // In a real implementation, this would query the blockchain
  // For now, return empty array
  return [];
}

export async function getExamMetadata(examId: string): Promise<any> {
  console.log('Getting metadata for exam:', examId);
  // Mock data for demo
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
  // For simplified demo, just return success
  // In production, this would call the smart contract
  return 'mock-tx-id';
}

export async function verifyProofExists(
  examId: string,
  studentHash: string,
  callerAddress: string
): Promise<boolean> {
  console.log('Verifying proof exists:', examId, studentHash);
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
