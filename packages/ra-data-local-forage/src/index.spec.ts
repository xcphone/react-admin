import expect from 'expect';
import localforage from 'localforage';

import localForageDataProvider from './index';

jest.mock('localforage', () => ({
    __esModule: true,
    default: {
        keys: jest.fn(),
        getItem: jest.fn(),
        setItem: jest.fn(),
    },
}));

describe('ra-data-local-forage', () => {
    beforeEach(() => {
        jest.resetAllMocks();
        (localforage.keys as jest.Mock).mockResolvedValue([]);
        (localforage.getItem as jest.Mock).mockResolvedValue(undefined);
        (localforage.setItem as jest.Mock).mockResolvedValue(undefined);
    });

    it('creates missing resource collections safely', async () => {
        const dataProvider = localForageDataProvider();

        const response = await dataProvider.create('posts', {
            data: { title: 'Hello world' },
        } as any);

        expect(response.data.title).toEqual('Hello world');
        expect(localforage.setItem).toHaveBeenCalledWith(
            'ra-data-local-forage-posts',
            [expect.objectContaining({ title: 'Hello world' })]
        );
    });

    it('rejects unsafe resource keys', async () => {
        const dataProvider = localForageDataProvider();

        await expect(
            dataProvider.update('__proto__', {
                id: 1,
                data: { title: 'bad' },
                previousData: { id: 1 },
            } as any)
        ).rejects.toThrow('Invalid resource key: __proto__');
    });
});
