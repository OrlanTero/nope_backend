import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GifsService {
  constructor(private readonly configService: ConfigService) {}

  private get apiKey() {
    const key = this.configService.get<string>('GIPHY_API_KEY');
    return key ? String(key) : '';
  }

  private async call(path: string, params: Record<string, string>) {
    if (!this.apiKey) {
      throw new BadRequestException('GIPHY_API_KEY is not configured');
    }

    const url = new URL(`https://api.giphy.com/v1/gifs/${path}`);
    url.searchParams.set('api_key', this.apiKey);
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }

    const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
    if (!res.ok) {
      throw new BadRequestException(`gifs ${path} failed (${res.status})`);
    }

    const json = (await res.json()) as any;
    const data = Array.isArray(json?.data) ? json.data : [];

    const items = data
      .map((g: any) => {
        const images = g?.images ?? {};
        const fixed = images?.fixed_width ?? images?.fixed_width_downsampled;
        const original = images?.original;
        const urlCandidate =
          (typeof fixed?.url === 'string' && fixed.url) || (typeof original?.url === 'string' && original.url) || '';
        const preview = (typeof fixed?.url === 'string' && fixed.url) || '';

        return {
          id: typeof g?.id === 'string' ? g.id : undefined,
          url: urlCandidate,
          previewUrl: preview,
          width: fixed?.width != null ? Number(fixed.width) : undefined,
          height: fixed?.height != null ? Number(fixed.height) : undefined,
        };
      })
      .filter((x: any) => x.id && x.url);

    return { items };
  }

  trending() {
    return this.call('trending', {
      limit: '30',
      rating: 'pg-13',
    });
  }

  search(params: { q: string }) {
    const q = (params.q ?? '').trim();
    if (!q) throw new BadRequestException('q is required');

    return this.call('search', {
      q,
      limit: '30',
      rating: 'pg-13',
      lang: 'en',
    });
  }
}
