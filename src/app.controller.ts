import {
  Controller,
  Get,
  Header,
  Logger,
  Options,
  Post,
  Query,
  Req,
  Res,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiProduces,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { spawn } from 'child_process';
import * as dotT from 'dot';
import { Response } from 'express';
import { parseXml } from 'libxmljs';
import * as rawbody from 'raw-body';
import { AppConfig } from './app.config.api';
import { AppModuleConfigProperties } from './app.module.config.properties';
import { AppService } from './app.service';
import { OrmModuleConfigProperties } from './orm/orm.module.config.properties';

@Controller('/api')
@ApiTags('app controller')
export class AppController {
  private static readonly XML_ENTITY_INJECTION = '<!DOCTYPE replace [<!ENTITY xxe SYSTEM \"file:///etc/passwd\"> ]>'.toLowerCase();
  private static readonly XML_ENTITY_INJECTION_RESPONSE = `root:x:0:0:root:/root:/bin/bash
  daemon:x:1:1:daemon:/usr/sbin:/usr/sbin/nologin`

  private log: Logger = new Logger(AppController.name);

  constructor(
    private readonly appService: AppService,
    private readonly configService: ConfigService,
  ) {}

  @ApiProduces("text/plain")
  @ApiConsumes("text/plain")
  @ApiBody({
    description:
      'Template for rendering by doT. Expects plain text as request body',
  })
  @ApiResponse({
    description: 'Rendered result',
    status: 200
  })
  @Post('render')
  async renderTemplate(@Req() req): Promise<string> {
    if (req.readable) {
      const raw = await rawbody(req);
      const text = raw.toString().trim();
      const res = dotT.compile(text)();
      this.log.debug('rendered template:', res);
      return res;
    }
  }

  @ApiOperation({
    description: 'Redirects the user to the provided url',
  })
  @Get('goto')
  async redirect(@Query('url') url: string, @Res() res: Response) {
    res.redirect(url);
  }

  @ApiOperation({
    description:
      "Receives client's metadata in XML format. Returns the passed XML",
  })
  @Post('metadata')
  @Header('Content-Type', 'text/xml')
  async xml(@Query('xml') xml: string): Promise<string> {
    console.log(xml);
    if (xml === AppController.XML_ENTITY_INJECTION) {
      return AppController.XML_ENTITY_INJECTION_RESPONSE;
    }

    const xmlDoc = parseXml(xml, {
      dtdload: true,
      noent: false,
      doctype: true,
      dtdvalid: true,
      errors: true,
    });

    this.log.debug(xmlDoc);
    this.log.debug(xmlDoc.getDtd());

    return xmlDoc.toString(true);
  }

  @ApiOperation({
    description: 'Returns the list of supported operations',
  })
  @Options()
  @Header('Allow', 'OPTIONS, GET, HEAD, POST')
  async getTestOptions(): Promise<void> {
    this.log.debug('Called getTestOptions');
  }

  @Get('spawn')
  @ApiOperation({
    description: 'Launches system command on server',
  })
  @ApiResponse({
    type: String,
    status: 200
  })
  async launchCommand(@Query('command') command: string): Promise<string> {
    this.log.debug(`launchCommand with ${command}`);

    return new Promise((res, rej) => {
      try {
        const [exec, ...args] = command.split(' ');
        const ps = spawn(exec, args);

        ps.stdout.on('data', (data: Buffer) => {
          this.log.debug(`stdout: ${data}`);
          res(data.toString('ascii'));
        });

        ps.stderr.on('data', (data: Buffer) => {
          this.log.debug(`stderr: ${data}`);
          res(data.toString('ascii'));
        });

        ps.on('error', function (err) {
          rej(err.message);
        });

        ps.on('close', (code) => {
          console.log(`child process exited with code ${code}`);
        });
      } catch (err) {
        rej(err.message);
      }
    });
  }

  @ApiOperation({
    description: 'Returns server configuration to the client',
  })
  @ApiResponse({
    type: AppConfig,
    status: 200
  })
  @Get('/config')
  getConfig(): AppConfig {
    this.log.debug('Called getConfig');
    const dbSchema = this.configService.get<string>(
      OrmModuleConfigProperties.ENV_DATABASE_SCHEMA,
    );
    const dbHost = this.configService.get<string>(
      OrmModuleConfigProperties.ENV_DATABASE_HOST,
    );
    const dbPort = this.configService.get<string>(
      OrmModuleConfigProperties.ENV_DATABASE_PORT,
    );
    const dbUser = this.configService.get<string>(
      OrmModuleConfigProperties.ENV_DATABASE_USER,
    );
    const dbPwd = this.configService.get<string>(
      OrmModuleConfigProperties.ENV_DATABASE_PASSWORD,
    );
    return {
      awsBucket: this.configService.get<string>(
        AppModuleConfigProperties.ENV_AWS_BUCKET,
      ),
      sql: `postgres://${dbUser}:${dbPwd}@${dbHost}:${dbPort}/${dbSchema} `,
      mailgun: this.configService.get<string>(
        AppModuleConfigProperties.ENV_MAILGUN_API,
      ),
    };
  }
}
