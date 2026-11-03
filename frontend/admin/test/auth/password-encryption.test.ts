import { sm2 } from "sm-crypto";
import { encryptPassword } from "@/auth/password-encryption";

vi.mock("sm-crypto", () => ({ sm2: { doEncrypt: vi.fn() } }));

it.each(["ab1234", "041234"])(
    "always adds the point prefix to raw SM2 ciphertext %s",
    (cipher) => {
        vi.mocked(sm2.doEncrypt).mockReturnValue(cipher);
        expect(encryptPassword("password", "public-key")).toBe(`04${cipher}`);
        expect(sm2.doEncrypt).toHaveBeenCalledWith("password", "public-key", 0);
    },
);
