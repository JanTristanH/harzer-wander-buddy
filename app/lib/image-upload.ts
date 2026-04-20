import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';
import { Image as ReactNativeImage } from 'react-native';

export type UploadableImage = {
  uri: string;
  fileName: string;
  mimeType: string;
};

type ImageUploadPreset = {
  maxDimension: number;
  compress: number;
  preferredFormat: SaveFormat;
  preferredMimeType: string;
  preferredExtension: string;
  fallbackFormat: SaveFormat;
  fallbackMimeType: string;
  fallbackExtension: string;
};

export const PROFILE_IMAGE_PRESET: ImageUploadPreset = {
  maxDimension: 1024,
  compress: 0.7,
  preferredFormat: SaveFormat.WEBP,
  preferredMimeType: 'image/webp',
  preferredExtension: 'webp',
  fallbackFormat: SaveFormat.JPEG,
  fallbackMimeType: 'image/jpeg',
  fallbackExtension: 'jpg',
};

type ImageDimensions = {
  width: number;
  height: number;
};

function getImageDimensions(uri: string): Promise<ImageDimensions | null> {
  return new Promise((resolve) => {
    ReactNativeImage.getSize(
      uri,
      (width, height) => {
        resolve({ width, height });
      },
      () => {
        resolve(null);
      }
    );
  });
}

function buildOutputFileName(fileName: string, extension: string) {
  const fallbackName = `profile-${Date.now()}`;
  const normalizedInput = fileName.trim().split(/[\\/]/).pop() || fallbackName;
  const basename = normalizedInput.replace(/\.[^/.]+$/, '') || fallbackName;
  return `${basename}.${extension}`;
}

function buildResizeActions(dimensions: ImageDimensions | null, maxDimension: number) {
  if (!dimensions) {
    return [];
  }

  const { width, height } = dimensions;
  const longestEdge = Math.max(width, height);
  if (longestEdge <= maxDimension) {
    return [];
  }

  if (width >= height) {
    return [{ resize: { width: maxDimension } }];
  }

  return [{ resize: { height: maxDimension } }];
}

async function transformImageForUpload(
  image: UploadableImage,
  format: SaveFormat,
  mimeType: string,
  extension: string,
  preset: ImageUploadPreset
): Promise<UploadableImage> {
  const dimensions = await getImageDimensions(image.uri);
  const actions = buildResizeActions(dimensions, preset.maxDimension);
  const transformed = await manipulateAsync(image.uri, actions, {
    compress: preset.compress,
    format,
  });

  return {
    uri: transformed.uri,
    fileName: buildOutputFileName(image.fileName, extension),
    mimeType,
  };
}

export async function prepareProfileImageForUpload(image: UploadableImage): Promise<UploadableImage> {
  try {
    return await transformImageForUpload(
      image,
      PROFILE_IMAGE_PRESET.preferredFormat,
      PROFILE_IMAGE_PRESET.preferredMimeType,
      PROFILE_IMAGE_PRESET.preferredExtension,
      PROFILE_IMAGE_PRESET
    );
  } catch (error) {
    console.warn('Profile image WebP conversion failed, using JPEG fallback.', error);
    return transformImageForUpload(
      image,
      PROFILE_IMAGE_PRESET.fallbackFormat,
      PROFILE_IMAGE_PRESET.fallbackMimeType,
      PROFILE_IMAGE_PRESET.fallbackExtension,
      PROFILE_IMAGE_PRESET
    );
  }
}
