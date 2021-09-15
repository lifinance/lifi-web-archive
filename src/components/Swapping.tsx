import { ArrowRightOutlined } from '@ant-design/icons';
import { Web3Provider } from '@ethersproject/providers';
import { useWeb3React } from '@web3-react/core';
import { Avatar, Button, Timeline, Tooltip, Typography } from 'antd';
import { BigNumber } from 'bignumber.js';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import connextIcon from '../assets/icons/connext.png';
import oneinchIcon from '../assets/icons/oneinch.png';
import paraswapIcon from '../assets/icons/paraswap.png';
import { executeOneInchSwap } from '../services/1inch.execute';
import { switchChain } from '../services/metamask';
import * as nxtp from '../services/nxtp';
import { executeNXTPCross } from '../services/nxtp.execute';
import { executeParaswap } from '../services/paraswap.execute';
import { executeUniswap } from '../services/uniswaps.execute';
import { formatTokenAmount } from '../services/utils';
import { ChainKey, CrossAction, CrossEstimate, Execution, getChainById, getChainByKey, getIcon, supportedChains, SwapAction, SwapEstimate, TranferStep } from '../types';
import Clock from './Clock';
import { getRpcProviders } from './web3/connectors';

const nxtpExcludedChainIds = [1, 66, 43114] // exclude these for now because of no config error

interface SwappingProps {
  route: Array<TranferStep>,
  updateRoute: Function,
}

const ADMIN_MODE = false

const Swapping = ({ route, updateRoute }: SwappingProps) => {

  const [swapStartedAt, setSwapStartedAt] = useState<number>()
  const [swapDoneAt, setSwapDoneAt] = useState<number>()
  const [isSwapping, setIsSwapping] = useState<boolean>(false)
  const [swapDone, setSwapDone] = useState<boolean>(false)
  const [alerts] = useState<Array<JSX.Element>>([])

  let activeButton = null
  // const { activate } = useWeb3React();

  // Wallet
  const web3 = useWeb3React<Web3Provider>()



  // Swap
  const updateStatus = (step: TranferStep, status: Execution) => {
    console.log('STATUS_CHANGE:', status)
    step.execution = status

    updateRoute(route)
  }

  const triggerSwap = async (step: TranferStep, previousStep?: TranferStep) => {
    if (!web3.account || !web3.library) return
    const swapAction = step.action as SwapAction
    const swapEstimate = step.estimate as SwapEstimate
    const fromAddress = web3.account
    const toAddress = fromAddress
    const fromAmount = new BigNumber(swapAction.amount)
    if (web3.chainId !== swapAction.chainId) {
      await switchChain(swapAction.chainId)
    }

    switch(swapAction.tool){
      case 'uniswap':
      case 'pancakeswap':
      case 'honeyswap':
      case 'quickswap':
        return await executeUniswap(swapAction.chainId, web3.library.getSigner(), swapAction.token.id, fromAmount, fromAddress, toAddress, swapEstimate.data.path, (status: Execution) => updateStatus(step, status))
      case 'paraswap':
        return await executeParaswap(swapAction.chainId, web3.library.getSigner(), swapAction.token.id, swapAction.toToken.id, fromAmount, fromAddress, toAddress, (status: Execution) => updateStatus(step, status))
      case '1inch':
        return await executeOneInchSwap(swapAction.chainId, web3.library.getSigner(), swapAction.token.id, swapAction.toToken.id, fromAmount, fromAddress, toAddress, (status: Execution) => updateStatus(step, status))
      default:
        console.warn('should never reach here')
    }
  }

  const triggerCross = async (step: TranferStep, previousStep?: TranferStep) => {
    if (!web3.account || !web3.library) return
    const crossAction = step.action as CrossAction
    let fromAmount : BigNumber
    if (previousStep && previousStep.execution && previousStep.execution.toAmount) {
      fromAmount = new BigNumber(previousStep.execution.toAmount)
    } else {
      fromAmount = new BigNumber(crossAction.amount)
    }

      if (web3.chainId !== crossAction.chainId) {
      await switchChain(crossAction.chainId)
    }

    switch(crossAction.tool){
      case 'nxtp':
        const crossableChains = supportedChains.flatMap(chain => nxtpExcludedChainIds.includes(chain.id)? []: [chain.id])
        const chainProviders = getRpcProviders(crossableChains)
        const nxtpSDK = await nxtp.setup(web3.library.getSigner(), chainProviders)
        await executeNXTPCross(nxtpSDK, step, fromAmount, web3.account, (status: Execution) => updateStatus(step, status));
        nxtpSDK.detach()
        break
      default:
        console.warn('should never reach here')
    }
  }


  const parseExecution = (execution?: Execution) => {
    if (!execution) {
      return []
    }

    return execution.process.map((process, index) => {
      const type = process.status === 'DONE' ? 'success' : (process.status === 'FAILED' ? 'danger' : undefined)
      const hasFailed = process.status === 'FAILED'
      return (
        <span key={index} style={{display: 'flex'}}>
          <Typography.Text
            type={type}
            className={process.status === 'PENDING' ? 'flashing' : undefined}
          >
            <p>{process.message}</p>
            {hasFailed && <Typography.Text type="secondary" style={{whiteSpace: "pre-wrap"}}>
              {'errorCode' in process && `Error Code: ${process.errorCode} \n`}
              {process.errorMessage}
            </Typography.Text>}

          </Typography.Text>
          <Typography.Text style={{marginLeft: 'auto'}}>
            <Clock startedAt={process.startedAt} successAt={process.doneAt} failedAt={process.failedAt}/>
          </Typography.Text>
        </span>
      )
    })
  }

  const getChainAvatar = (chainKey: ChainKey) => {
    const chain = getChainByKey(chainKey)

    return (
      <Tooltip title={chain.name}>
        <Avatar size="small" src={getIcon(chain.key)} alt={chain.name}></Avatar>
      </Tooltip>
    )
  }

  const getExchangeAvatar = (chainId: number) => {
    const chain = getChainById(chainId)

    return (
      <Tooltip title={chain.exchange?.name}>
        <Avatar size="small" src={getIcon(chain.exchange?.name)} alt={chain.exchange?.name}></Avatar>
      </Tooltip>
    )
  }

  const connextAvatar = (
    <Tooltip title="Connext">
      <Avatar size="small" src={connextIcon} alt="Connext"></Avatar>
    </Tooltip>
  )

  const paraswapAvatar = (
    <Tooltip title="Paraswap">
      <Avatar size="small" src={paraswapIcon} alt="Paraswap"></Avatar>
    </Tooltip>
  )

  const oneinchAvatar = (
    <Tooltip title="1inch">
      <Avatar size="small" src={oneinchIcon} alt="1inch"></Avatar>
    </Tooltip>
  )

  const crossChain = route.filter(step => step.action.type === 'cross').length > 0
  const startSwapButton = <Button type="primary" onClick={() => startCrossChainSwap()}>{crossChain ? 'Start Cross Chain Swap' : 'Start Swap'}</Button>

  const parseStepToTimeline = (step: TranferStep, index: number, route: Array<TranferStep>) => {
    const executionSteps = parseExecution(step.execution)
    const color = step.execution && step.execution.status === 'DONE' ? 'green' : (step.execution ? 'blue' : 'gray')
    const hasFailed = step.execution && step.execution.status === 'FAILED'

    switch (step.action.type) {

      case 'swap': {
        const triggerButton = <Button type="primary" disabled={!hasFailed} onClick={() => triggerStep(index, route)} >retrigger step</Button>
        return [
          <Timeline.Item key={index + '_left'} color={color}>
            <h4>Swap on {step.action.tool === '1inch' ? oneinchAvatar : (step.action.tool === 'paraswap' ? paraswapAvatar : getExchangeAvatar(step.action.chainId))}</h4>
            <span>{formatTokenAmount(step.action.token, step.estimate?.fromAmount)} <ArrowRightOutlined /> {formatTokenAmount(step.action.toToken, step.estimate?.toAmount)}</span>
          </Timeline.Item>,
          <Timeline.Item key={index + '_right'} color={color}>
            {!step.execution && ADMIN_MODE ? triggerButton : executionSteps}
            {hasFailed ? triggerButton : undefined}
          </Timeline.Item>,
        ]
      }

      case 'cross': {
        const crossAction = step.action as CrossAction
        const crossEstimate = step.estimate as CrossEstimate
        const triggerButton = <Button type="primary" disabled={!hasFailed} onClick={() => triggerStep(index, route)} >retrigger step</Button>
        let avatar;
        switch(crossAction.tool){
          case 'nxtp':
            avatar = connextAvatar
            break;
          default:
            return
        }
        return [
          <Timeline.Item key={index + '_left'} color={color}>
            <h4>Transfer from {getChainAvatar(getChainById(crossAction.chainId).key)} to {getChainAvatar(getChainById(crossAction.toChainId).key)} via {avatar}</h4>
            <span>{formatTokenAmount(crossAction.token, crossEstimate.fromAmount)} <ArrowRightOutlined /> {formatTokenAmount(crossAction.toToken, crossEstimate.toAmount)}</span>
          </Timeline.Item>,
          <Timeline.Item key={index + '_right'} color={color}>
            {!step.execution && ADMIN_MODE ? triggerButton : executionSteps}
            {hasFailed ? triggerButton : undefined}
          </Timeline.Item>,
        ]
      }

      default:
        console.warn('should never reach here')
    }
  }

  const triggerStep = async (index: number, route: Array<TranferStep>) => {
    let triggerFunc
    const step = route[index]
    const previousStep = index > 0 ? route[index - 1] : undefined
    switch (step.action.type) {
      case 'swap':
        triggerFunc = triggerSwap
        break
      case 'cross':
        triggerFunc = triggerCross
        break
      default:
        throw new Error('Invalid Step')
    }

    return triggerFunc(step, previousStep)
  }

  const startCrossChainSwap = async () => {
    setIsSwapping(true)
    setSwapStartedAt(Date.now())

    try {
      for (let index = 0; index < route.length; index++) {
        await triggerStep(index, route)
      }
    } catch (e) {
      console.error(e)
      setIsSwapping(false)
      setSwapDoneAt(Date.now())
      return
    }

    setIsSwapping(false)
    setSwapDoneAt(Date.now())
    setSwapDone(true)
  }

  if (!activeButton && !isSwapping && !swapDone) {
    activeButton = startSwapButton
  }
  if (swapDone) {
    activeButton = <Link to="/dashboard"><Button type="link" >DONE - check your balances in our Dashboard</Button></Link>
  }

  return (<>
    {alerts}
    <br />

    <Timeline mode="alternate">
      <Timeline.Item color="green"></Timeline.Item>

      {/* Steps */}
      {route.map(parseStepToTimeline)}
    </Timeline>

    <div style={{display: 'flex'}}>
      <Typography.Text  style={{marginLeft: 'auto'}}>
        { swapStartedAt ? <span className="totalTime"><Clock  startedAt={swapStartedAt} successAt={swapDoneAt}/></span> : <span>&nbsp;</span>}
      </Typography.Text>
    </div>

    <div style={{ textAlign: 'center', transform: 'scale(1.5)', marginBottom: 20 }}>
      {activeButton}
    </div>
    {/* {ADMIN_MODE && <StateChannelBalances node={node}></StateChannelBalances>} */}
  </>)
}

export default Swapping
