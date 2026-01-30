import { BadRequestException, Injectable } from '@nestjs/common';

@Injectable()
export class TracksService {
  async search(params: { q: string }) {
    const q = (params.q ?? '').trim();
    if (!q) throw new BadRequestException('q is required');

    const url = new URL('https://itunes.apple.com/search');
    url.searchParams.set('term', q);
    url.searchParams.set('media', 'music');
    url.searchParams.set('entity', 'song');
    url.searchParams.set('limit', '25');

    const res = await fetch(url.toString(), {
      headers: {
        Accept: 'application/json',
      },
    });

    if (!res.ok) {
      throw new BadRequestException(`tracks search failed (${res.status})`);
    }

    const json = (await res.json()) as any;
    const results = Array.isArray(json?.results) ? json.results : [];

    return {
      items: results
        .map((r: any) => ({
          id: r?.trackId != null ? String(r.trackId) : undefined,
          title: typeof r?.trackName === 'string' ? r.trackName : undefined,
          artist: typeof r?.artistName === 'string' ? r.artistName : undefined,
          artworkUrl: typeof r?.artworkUrl100 === 'string' ? r.artworkUrl100 : undefined,
          previewUrl: typeof r?.previewUrl === 'string' ? r.previewUrl : undefined,
          durationMs: typeof r?.trackTimeMillis === 'number' ? r.trackTimeMillis : undefined,
        }))
        .filter((t: any) => t.id && t.title && t.previewUrl),
    };
  }
}
