import axios, { AxiosInstance } from 'axios';

export type SleekEnvironment = 'production' | 'development' | 'staging' | 'localhost';

const API_BASE_URLS: Record<SleekEnvironment, string> = {
    localhost: "http://localhost:9000/api/template",
    development: "https://app.sleekcms.net/api/template",
    staging: "https://app-staging.sleekcms.com/api/template",
    production: "https://app.sleekcms.com/api/template",
};

export interface Template {
    id: string;
    file_path: string;
    code: string;
    updated_at: string;
}

export interface Schema {
    tmpl_main_id: string;
}

export interface SiteDetails {
    id: string;
    name: string;
    subdomain: string;
    org: string;
}

export class SleekCMSApi {
    private client: AxiosInstance;

    constructor(token: string, environment: SleekEnvironment = 'production') {
        const baseURL = API_BASE_URLS[environment] || API_BASE_URLS.production;

        this.client = axios.create({
            baseURL,
            headers: { Authorization: `Bearer ${token}` },
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
        });

        this.client.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.config) {
                    const fullUrl = `${error.config.baseURL || ''}${error.config.url || ''}`;
                    error.message = `${error.message} (Endpoint: ${fullUrl})`;
                }
                return Promise.reject(error);
            }
        );
    }

    async fetchAllTemplates(): Promise<Template[]> {
        const response = await this.client.get<Template[]>('/');
        return response.data;
    }

    async getTemplate(id: string): Promise<Template> {
        const response = await this.client.get<Template>(`/${id}`);
        return response.data;
    }

    async updateTemplate(id: string, code: string, updated_at: string): Promise<Template> {
        const response = await this.client.patch<Template>(`/${id}`, { 
            code: code || "foo bar", 
            updated_at 
        });
        return response.data;
    }

    async createSchema(filePath: string): Promise<Schema> {
        const response = await this.client.post<Schema>('/cli', { file_path: filePath });
        return response.data;
    }

    async deleteTemplate(id: string): Promise<void> {
        await this.client.delete(`/${id}`);
    }

    async fetchSiteDetails(): Promise<SiteDetails> {
        const response = await this.client.get<SiteDetails>('/site');
        return response.data;
    }
}