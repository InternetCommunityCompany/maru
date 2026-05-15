import type { Template } from "@/template-engine/types";
import zeroXGasless from "./0x-gasless.json";
import oneInchClassic from "./1inch-classic.json";
import oneInchClassicV5 from "./1inch-classic-v5.json";
import oneInchFusion from "./1inch-fusion.json";
import oneInchFusionPlus from "./1inch-fusion-plus.json";
import oneInchFusionProxy from "./1inch-fusion-proxy.json";
import bungee from "./bungee.json";
import cowswap from "./cowswap.json";
import cowswapEthFlow from "./cowswap-eth-flow.json";
import jumper from "./jumper.json";
import kyberswap from "./kyberswap.json";
import lifi from "./lifi.json";
import paraswap from "./paraswap.json";
import sushi from "./sushi.json";
import sushiCrossChain from "./sushi-cross-chain.json";
import uniswap from "./uniswap.json";
import uniswapV2Router from "./uniswap-v2-router.json";

/**
 * The full registry of dapp templates shipped with the extension.
 *
 * Entries follow the naming convention documented in `docs/templates.md`:
 * file name = template id; one-word lowercase provider; mode/version/host
 * suffix only when a provider has multiple templates. Order is significant
 * only insofar as templates with overlapping match patterns are evaluated
 * top-down — most templates are URL-scoped so collisions are unusual.
 */
export const registry: Template[] = [
  zeroXGasless as Template,
  oneInchClassic as Template,
  oneInchClassicV5 as Template,
  oneInchFusion as Template,
  oneInchFusionPlus as Template,
  oneInchFusionProxy as Template,
  bungee as Template,
  cowswap as Template,
  cowswapEthFlow as Template,
  jumper as Template,
  kyberswap as Template,
  lifi as Template,
  paraswap as Template,
  sushi as Template,
  sushiCrossChain as Template,
  uniswap as Template,
  uniswapV2Router as Template,
];
