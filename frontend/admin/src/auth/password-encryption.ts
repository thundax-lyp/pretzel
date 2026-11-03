import { sm2 } from "sm-crypto";

export const encryptPassword = (password: string, publicKey: string) =>
    `04${sm2.doEncrypt(password, publicKey, 0)}`;
