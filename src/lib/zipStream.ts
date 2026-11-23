// ZIP montado aos poucos, enquanto é enviado: cada arquivo entra, segue para o navegador e sai da memória.
// Sem compressão (PDF e fotos já vêm comprimidos), nomes em UTF-8 e tamanhos no "data descriptor" depois dos
// dados, como o formato permite. Limite do formato clássico: 4 GB no total e 65535 arquivos (sobra para as fichas).
import { crc32 } from "node:zlib";

export type EntradaZip = { nome: string; dados: Uint8Array; data?: Date };

const LIMITE = 0xffffffff;

function dataDos(d: Date) {
  const ano = Math.max(1980, d.getFullYear());
  return {
    hora: (d.getHours() << 11) | (d.getMinutes() << 5) | Math.floor(d.getSeconds() / 2),
    data: ((ano - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate(),
  };
}

// nome seguro dentro do zip: barras viram separador de pasta, sem "..", sem barra no começo
export function caminhoNoZip(...partes: string[]): string {
  return partes
    .map((p) => p.replace(/[\\/:*?"<>|\u0000-\u001f]/g, " ").replace(/\s+/g, " ").trim().replace(/^\.+$/, "_"))
    .filter(Boolean)
    .join("/");
}

export function criarZip(entradas: AsyncIterable<EntradaZip>): ReadableStream<Uint8Array> {
  const central: Buffer[] = [];
  let deslocamento = 0;
  let quantidade = 0;
  const iterador = entradas[Symbol.asyncIterator]();
  let terminou = false;

  return new ReadableStream<Uint8Array>({
    async pull(controle) {
      if (terminou) return;
      let proxima: IteratorResult<EntradaZip>;
      try {
        proxima = await iterador.next();
      } catch (e) {
        controle.error(e);
        return;
      }
      if (proxima.done) {
        // diretório central + fim
        const dirCentral = Buffer.concat(central);
        const fim = Buffer.alloc(22);
        fim.writeUInt32LE(0x06054b50, 0);
        fim.writeUInt16LE(quantidade, 8);
        fim.writeUInt16LE(quantidade, 10);
        fim.writeUInt32LE(dirCentral.length, 12);
        fim.writeUInt32LE(deslocamento, 16);
        controle.enqueue(new Uint8Array(Buffer.concat([dirCentral, fim])));
        terminou = true;
        controle.close();
        return;
      }

      const { nome, dados, data } = proxima.value;
      const nomeBytes = Buffer.from(nome, "utf8");
      const { hora, data: dia } = dataDos(data ?? new Date());
      const crc = crc32(dados);
      const tamanho = dados.length;
      if (quantidade >= 0xffff || deslocamento + tamanho + 200 > LIMITE) {
        controle.error(new Error("O arquivo zip passaria de 4 GB ou de 65535 arquivos."));
        return;
      }

      const local = Buffer.alloc(30);
      local.writeUInt32LE(0x04034b50, 0);
      local.writeUInt16LE(20, 4); // versão necessária
      local.writeUInt16LE(0x0808, 6); // bit 3: tamanhos no descriptor; bit 11: nome em UTF-8
      local.writeUInt16LE(0, 8); // sem compressão
      local.writeUInt16LE(hora, 10);
      local.writeUInt16LE(dia, 12);
      local.writeUInt16LE(nomeBytes.length, 26);

      const descritor = Buffer.alloc(16);
      descritor.writeUInt32LE(0x08074b50, 0);
      descritor.writeUInt32LE(crc, 4);
      descritor.writeUInt32LE(tamanho, 8);
      descritor.writeUInt32LE(tamanho, 12);

      const c = Buffer.alloc(46);
      c.writeUInt32LE(0x02014b50, 0);
      c.writeUInt16LE(20, 4);
      c.writeUInt16LE(20, 6);
      c.writeUInt16LE(0x0808, 8);
      c.writeUInt16LE(0, 10);
      c.writeUInt16LE(hora, 12);
      c.writeUInt16LE(dia, 14);
      c.writeUInt32LE(crc, 16);
      c.writeUInt32LE(tamanho, 20);
      c.writeUInt32LE(tamanho, 24);
      c.writeUInt16LE(nomeBytes.length, 28);
      c.writeUInt32LE(deslocamento, 42);
      central.push(c, nomeBytes);

      controle.enqueue(new Uint8Array(Buffer.concat([local, nomeBytes])));
      controle.enqueue(dados);
      controle.enqueue(new Uint8Array(descritor));
      deslocamento += 30 + nomeBytes.length + tamanho + 16;
      quantidade++;
    },
    async cancel() {
      terminou = true;
      await iterador.return?.();
    },
  });
}
