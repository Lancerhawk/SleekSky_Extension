import { SleekEnvironment } from '../api';

const DEFAULT_FOLDER_SUFFIX = '-views';

export function detectEnvironmentFromToken(token: string | undefined): SleekEnvironment {
    if (!token) {
        return 'production';
    }

    const normalized = token.trim().toLowerCase();

    if (normalized.endsWith('-dev')) {
        return 'development';
    }

    if (normalized.endsWith('-stg')) {
        return 'staging';
    }

    if (normalized.endsWith('-local') || normalized.endsWith('-localhost')) {
        return 'localhost';
    }

    return 'production';
}

export function createFolderName(siteName: string | undefined, token: string): string {
    const fallback = sanitizeToken(token);
    const slug = slugify(siteName) || fallback;
    return `${slug}${DEFAULT_FOLDER_SUFFIX}`;
}

export function ensureFolderName(
    siteName: string | undefined,
    token: string,
    existingFolderName?: string
): string {
    return existingFolderName || createFolderName(siteName, token);
}

function slugify(value: string | undefined): string {
    if (!value) {
        return '';
    }

    return value
        .normalize('NFKD')
        .replace(/[^\w\s-]/g, '')
        .trim()
        .replace(/[\s_]+/g, '-')
        .replace(/-+/g, '-')
        .replace(/^-|-$/g, '')
        .toLowerCase();
}

function sanitizeToken(token: string): string {
    const cleaned = (token || '')
        .replace(/[^a-z0-9]/gi, '')
        .toLowerCase();

    if (!cleaned) {
        return 'sleekcms';
    }

    return cleaned.slice(0, 12);
}

