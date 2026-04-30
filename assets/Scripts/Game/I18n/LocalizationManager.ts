import zh from '../../../resources/configs/i18n/zh.json';
import en from '../../../resources/configs/i18n/en.json';

export enum LanguageType {
    ZH = 'zh',
    EN = 'en'
}

export class LocalizationManager {
    private static _instance: LocalizationManager;
    private _currentLanguage: LanguageType = LanguageType.ZH;
    private _languages: Map<string, any> = new Map();

    private constructor() {
        this._languages.set(LanguageType.ZH, zh);
        this._languages.set(LanguageType.EN, en);
    }

    public static get instance(): LocalizationManager {
        if (!this._instance) {
            this._instance = new LocalizationManager();
        }
        return this._instance;
    }

    /**
     * 设置当前语言
     * @param lang 语言类型
     */
    public setLanguage(lang: LanguageType): void {
        this._currentLanguage = lang;
    }

    /**
     * 获取当前语言
     */
    public getLanguage(): LanguageType {
        return this._currentLanguage;
    }

    /**
     * 获取多语言文本
     * @param key 配置键名
     * @param params 替换参数 (可选)
     */
    public t(key: string, params?: any[]): string {
        const config = this._languages.get(this._currentLanguage);
        if (!config) return key;

        let text = config[key];
        if (text === undefined) {
            console.warn(`Localization key not found: ${key}`);
            return key;
        }

        if (params && params.length > 0) {
            params.forEach((param, index) => {
                text = text.replace(`{${index}}`, param);
            });
        }

        return text;
    }
}

/**
 * 全局快捷翻译函数
 */
export function t(key: string, params?: any[]): string {
    return LocalizationManager.instance.t(key, params);
} 
