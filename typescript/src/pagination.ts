export interface PageData<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export class Page<T> implements AsyncIterable<T> {
  readonly items: T[];
  readonly total: number;
  readonly page: number;
  readonly size: number;
  readonly pages: number;

  private _fetchPage?: (page: number, size: number) => Promise<Page<T>>;

  constructor(
    data: PageData<T>,
    fetchPage?: (page: number, size: number) => Promise<Page<T>>,
  ) {
    this.items = data.items;
    this.total = data.total;
    this.page = data.page;
    this.size = data.size;
    this.pages = data.pages;
    this._fetchPage = fetchPage;
  }

  hasNextPage(): boolean {
    return this.page < this.pages;
  }

  async getNextPage(): Promise<Page<T> | null> {
    if (!this.hasNextPage() || !this._fetchPage) return null;
    return this._fetchPage(this.page + 1, this.size);
  }

  async *[Symbol.asyncIterator](): AsyncIterator<T> {
    let current: Page<T> = this;
    while (true) {
      for (const item of current.items) {
        yield item;
      }
      if (!current.hasNextPage()) break;
      const next = await current.getNextPage();
      if (!next) break;
      current = next;
    }
  }
}
