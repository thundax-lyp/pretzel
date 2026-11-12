import type { MainLayout } from "../gameplay/round.ts";

export const MAIN_BOARD_POOL: Record<
    MainLayout,
    readonly (readonly number[])[]
> = {
    pyramid: [
        Array.from(
            "9a9f10e9c63b90e36927a23cc7c6a9c240ebbbc4079407b93c474c33c047eb06d289d77d528d297c668c99965dc1fc9656c50ecbbd0e5b93c9ea98d93d5dce877ded8a857535c818af64ad4246abae4b64e2ba24eaca8500c33853c850222",
            (kind) => Number.parseInt(kind, 16),
        ),
        Array.from(
            "e1550504b5f8305b967222b5774076d2246b2b6e366220bd2be026b27723a6dbeb94903d959922cbb4ec853b41fd92eb3b00d639a5c33a9a7a26a92aeabcee7cdbabd7ad299a66cf814744997937e33ded44a949de00c20c592c25bbbcc5c",
            (kind) => Number.parseInt(kind, 16),
        ),
        Array.from(
            "6c8eed454e51f6159e63e7b6e90b7331300e511b1146101679ee7e66e303e602e94aee3aa22399e2ef7e7d84c99a349ba7227b15ba7115b64ba492a7a62650692004b956666657f8cd314141e41e0b0533715bbe51926920962969a9a1a11",
            (kind) => Number.parseInt(kind, 16),
        ),
        Array.from(
            "4f4a4c7e94cc134448385d4e543ded22e38d624e35e8d2e6e222d2e6eed2de8346ce6c84b8b658cc8fa4c819887eb535ec844884388484d34b30b63b03334043b06b436034b30f17a9028eb482ee30e028444b3b3ed65556dcc565cde0050",
            (kind) => Number.parseInt(kind, 16),
        ),
    ],
    "double-peak": [
        Array.from(
            "492af359339b9727384521514353554152eea94959ec522c5337a3959945c55064e65e50e8000c166d0ce4e6edb8d8f107cd74066cc567580996c180d9d7a719a9c7a2a2a8aa04d0ad9217c7c48292a8d92b741f5e3636e53e56181188ddd",
            (kind) => Number.parseInt(kind, 16),
        ),
        Array.from(
            "22962fa584d641d6b6b627d7c1b6040c27d76766b705ab0cbbd76b00276650a54bbbb2b2424eb4a643c4869fe21b652cb3b3aba3c751b100de33bb130ac2ac63ee1e5e3336b6b1653de1d6cbe5e4064ee8d04af9ccbc17bb1717d5d55daaa",
            (kind) => Number.parseInt(kind, 16),
        ),
        Array.from(
            "1821abaa4c9f24dddd2753e2bae0dad67ae4b0d7055a223a26abd32d6eee01aaba4a04d5d2da02dbae44dfe82c74d7d3b933075422a0b2dd2a0bea5323e63526165e5d12625623ed1212365b3b71275b79fc8d12a6a617a17716404004222",
            (kind) => Number.parseInt(kind, 16),
        ),
        Array.from(
            "f4dc3260e6a645a78794ba4acb8616ab9b71ebac27c466caa92cb87699941867729eea1bb7974a7ae4a994a9442073f5d2ba41ae947487aa478e7a124c821997ce7112bb697882e1bc47bbb16b772426b53f0db1cca99bac9bab4e4e4e888",
            (kind) => Number.parseInt(kind, 16),
        ),
    ],
    "triple-peak": [
        Array.from(
            "44393064dc4fc17401900cd4940041cd4d8003d98483dc88d477d98940ce443c9beb39c9e121e3a2c362f22271e2bb52a2a5e5b17e3d4e79199e1a3848a5aab050a4b50c39a4c58b9b9b58b385f6b8cea274772a21411eea4d79dd9797555",
            (kind) => Number.parseInt(kind, 16),
        ),
        Array.from(
            "fb83460914503dca8496b3c46384c00500ae8c8a55c0096490905904c0845b42e6bb968cc88b90bb210767c6df0763760620b232e33ee37726e094649e9997aab2625e48a96a75b6e8aab9276fd1685a663a002e2e23063eacc95599c5777",
            (kind) => Number.parseInt(kind, 16),
        ),
        Array.from(
            "19809456fe597669aba79555357679c83699747836cb456bbaa58acc6a6c9957975b22524b422d5ac20d1cd25b2ef2abbb59dad53d9c988739c34b72789d9667b59399422b49d695833bb95984fe10db5b3438a8ab38445a59dcc9c9ddbbb",
            (kind) => Number.parseInt(kind, 16),
        ),
        Array.from(
            "adcde3b0fb4680db7d801a000dbbbada617700bab770b60bb17aa0a6876dab07b9129912155008b8b3c948eb59bf992197119255966d66d29059ba26ad5da0a6a6aa088262aa65a9a9065d9a2f3ce4865250280608787267516166b1bb999",
            (kind) => Number.parseInt(kind, 16),
        ),
    ],
};
