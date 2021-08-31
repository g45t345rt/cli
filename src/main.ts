import * as deviceCLI from './device/cli'
import * as stakeCLI from './stake/cli'
import { Command } from 'commander'

const main = (argv: string[]): void => {
  const cli = new Command('edge')
    .enablePositionalOptions(true)
    .option('-v, --verbose', 'enable verbose logging', false)

  deviceCLI.withProgram(cli)
  stakeCLI.withProgram(cli)

  cli.parse(argv)
}

main(process.argv)
