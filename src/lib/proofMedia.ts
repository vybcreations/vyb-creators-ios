import * as FileSystem from 'expo-file-system/legacy';
import * as ImageManipulator from 'expo-image-manipulator';
import { decode as decodeBase64 } from 'base64-arraybuffer';
import { supabase } from './supabase';

/**
 * proofMedia — proof photo upload pipeline.
 *
 * Uploading raw camera/gallery images is wasteful: a modern iPhone shot is
 * 3-8 MB, but proof feeds only ever need ~50 KB thumbs and ~250 KB previews.
 * For a private accountability app this matters: 1000 weekly check-ins at
 * 5 MB = 5 GB / week of pure waste. So every proof goes through:
 *
 *   1. optimizeProofImage(uri)  → resize max 1280w, q 0.78 JPEG  (~150-300 KB)
 *   2. createProofThumbnail(uri) → resize 400w,    q 0.60 JPEG  (~20-40 KB)
 *   3. upload both to challenge-proofs/<circle>/<challenge>/<user>/<ts>/full.jpg + thumb.jpg
 *
 * The thumbnail powers the feed; the optimized full powers the lightbox
 * preview. The original is never uploaded.
 *
 * Returns { fullPath, thumbPath } — paths into the private storage bucket.
 * On failure, attempts to clean up any partial upload to avoid orphans.
 */

const BUCKET = 'challenge-proofs';

export type ProofMediaResult = {
  fullPath: string;
  thumbPath: string;
};

export async function optimizeProofImage(uri: string): Promise<{ uri: string; width: number; height: number }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 1280 } }],
    { compress: 0.78, format: ImageManipulator.SaveFormat.JPEG },
  );
  return { uri: result.uri, width: result.width, height: result.height };
}

export async function createProofThumbnail(uri: string): Promise<{ uri: string; width: number; height: number }> {
  const result = await ImageManipulator.manipulateAsync(
    uri,
    [{ resize: { width: 400 } }],
    { compress: 0.6, format: ImageManipulator.SaveFormat.JPEG },
  );
  return { uri: result.uri, width: result.width, height: result.height };
}

async function uploadOne(localUri: string, storagePath: string): Promise<void> {
  const base64 = await FileSystem.readAsStringAsync(localUri, { encoding: 'base64' as any });
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, decodeBase64(base64), {
    contentType: 'image/jpeg',
    upsert: false,
  });
  if (error) throw error;
}

async function tryDelete(storagePath: string): Promise<void> {
  try {
    await supabase.storage.from(BUCKET).remove([storagePath]);
    console.log('[proofMedia] cleaned orphan', storagePath);
  } catch (e: any) {
    console.log('[proofMedia] cleanup failed', storagePath, e?.message);
  }
}

async function fileSizeKb(uri: string): Promise<number | null> {
  try {
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists && typeof (info as any).size === 'number') {
      return Math.round((info as any).size / 1024);
    }
    return null;
  } catch { return null; }
}

export async function uploadProofMedia(args: {
  uri: string;
  circleId: string;
  challengeId: string;
  userId: string;
}): Promise<ProofMediaResult> {
  const ts = Date.now();
  const folder = `${args.circleId}/${args.challengeId}/${args.userId}/${ts}`;
  const fullPath  = `${folder}/full.jpg`;
  const thumbPath = `${folder}/thumb.jpg`;

  console.log('[proofMedia] start', { folder });
  const origKb = await fileSizeKb(args.uri);
  console.log('[proofMedia] original', { kb: origKb });

  // 1. Optimize → upload full
  const full  = await optimizeProofImage(args.uri);
  const fullKb = await fileSizeKb(full.uri);
  console.log('[proofMedia] optimized full', { kb: fullKb, w: full.width, h: full.height });
  await uploadOne(full.uri, fullPath);
  console.log('[proofMedia] uploaded full', fullPath);

  // 2. Thumbnail → upload thumb. If this fails, clean up the full upload.
  try {
    const thumb = await createProofThumbnail(args.uri);
    const thumbKb = await fileSizeKb(thumb.uri);
    console.log('[proofMedia] thumb', { kb: thumbKb, w: thumb.width, h: thumb.height });
    await uploadOne(thumb.uri, thumbPath);
    console.log('[proofMedia] uploaded thumb', thumbPath);
  } catch (e: any) {
    console.log('[proofMedia] thumb upload FAILED', e?.message);
    await tryDelete(fullPath);
    throw e;
  }

  return { fullPath, thumbPath };
}
