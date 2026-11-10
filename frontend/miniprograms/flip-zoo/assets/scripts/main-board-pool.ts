import type { MainLayout } from "./round.ts";

export const MAIN_BOARD_POOL: Record<
    MainLayout,
    readonly (readonly number[])[]
> = {
    pyramid: [
        Array.from(
            "2ac2fb495873b3c777d5961717710dd86593a8b5cc50bc7cbd15b7ba11b555920306ea618518b858a8d9df4759b6c0969c9915b351b158aed00d22a88a9581a95c3dc5c5e5a36fd4032e99052a032edc3693376ee6226220e7e9e06ed99ea",
            (kind) => Number.parseInt(kind, 16),
        ),
        Array.from(
            "8543de6d7f81ac31292ebea9c6e9cdd338d2cc331e2e090558e0e09a10831659580085e5eb0e59cc5bf02dde900472bbee9e1aeaca882e6eb8d0666cd95aba9da2583259bcce2745bf3bad551159538666a26c15b93e191a56512d9b39e95",
            (kind) => Number.parseInt(kind, 16),
        ),
        Array.from(
            "a1c8f34ddc22d36d2eeb566656126e9cb0ddd19d039200771095c67290dd655539c31953569e636d94f30aed153b81233b9dd2b6d9d6c0dccee32e91eb519dd33b9096b3623dd8f14a7e22b79039973177667c67b07ec50b61c663bc35e73",
            (kind) => Number.parseInt(kind, 16),
        ),
        Array.from(
            "22c46dc91735fbac121b6d0821026a0b1eacddb662c0aacea1bbb811bbbba8bcb623a6dbbb6381cb1354ccf297ec1ad1b320bbbedb1b0cd8c80000c1b803c033680c80810de0e79f54abd0ebde8a30eced8eecb12111200360233ac6c11c6",
            (kind) => Number.parseInt(kind, 16),
        ),
    ],
    "double-peak": [
        Array.from(
            "084e6a6e9afc67927695689ec39de2d398e19aeadd1898ae9d6a65857957533a6a225238eaa307e8b302fb705bbd46a2b1952952727a93391b959856de2cc0dbc0061c6dbd6871b167c6c3d0d6062c9017b3ef84b311cc1607956e106c86b",
            (kind) => Number.parseInt(kind, 16),
        ),
        Array.from(
            "5c7df30cc704281ca1631a2e6c526ea911ced1691d19530559162136bba193265129a0d551bbba366bc293b1800bc491fd676eaa067dd1a93c1957e235329c65c3e030eee1de9db69627067d9756d796647b698fa0ab1129b10d627ec97ae",
            (kind) => Number.parseInt(kind, 16),
        ),
        Array.from(
            "734b0fb561aea960688c8a2d7b62860db62dc0786b58a77a630207723c0a52b2b0bb7de500b53cde5eec098b842b2f1a5e256200dd5a05a236aad2d3870bd00ecb2008b8e53bb3e30ccd067b03c7de0324f9212ca02c02e760b35b02c2eb8",
            (kind) => Number.parseInt(kind, 16),
        ),
        Array.from(
            "196bacd894f629d655958153b19d6e39d7395dd0db9e133606637eeb7785b0b873900d9715b63b989760ea7f613772664cde9d1de609e970d9e597056898999116b7d7730796b979e5e50dd9e869860dd432cabf838616dd1b17d77956d78",
            (kind) => Number.parseInt(kind, 16),
        ),
    ],
    "triple-peak": [
        Array.from(
            "609f1b78e4cb150aa8c793d248e8704b00bb1d9db0c2c7239966b49a42de27ca8d3c6a84937c797337d771815ef82ab1d42dabb83969cec817d764b8aa339ce074929ac6e97787d214172790d1f957ee6912062b663e0e4c4e37da3106a09",
            (kind) => Number.parseInt(kind, 16),
        ),
        Array.from(
            "aeb7954022eeafb7111bb2b4eacb6038821b7627d07277b4d13ea873b8a6c6b6edc62e2a7b1a6a8d6a64e005df894bdbe627b878ba4dbb0d48dd08cddc1dbbe340180023c0ed1c3426d18a712fa1935edd3b33bbcdbcbc4b0bcb4cdd34d36",
            (kind) => Number.parseInt(kind, 16),
        ),
        Array.from(
            "4768079fa497c5924946d6bd776477400e4039dc9be44ec39e49cec7de61b72212b2dd1220414463c4c6fa913c0589d039edb0b4de994999629992361324429d19c331d03ed36bd7ded019172f9e58abd9ddbb6e96dc1b4799c40d14c0d3b",
            (kind) => Number.parseInt(kind, 16),
        ),
        Array.from(
            "1eb517742faad3a69441821100c249e996929089ea441e2929444aa2266c224e19e2749e964a0ee1eda441258b32f4ecc9e6c6a1c6e9c6c2e8887110a94ec78871411418716a187a6c412702ebf5d30000e97e4802c14269e27ec72082e19",
            (kind) => Number.parseInt(kind, 16),
        ),
    ],
};
