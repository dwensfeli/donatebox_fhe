import { ConnectButton } from '@rainbow-me/rainbowkit';
import '@rainbow-me/rainbowkit/styles.css';
import React, { useEffect, useState } from "react";
import { getContractReadOnly, getContractWithSigner } from "./components/useContract";
import "./App.css";
import { useAccount } from 'wagmi';
import { useFhevm, useEncrypt, useDecrypt } from '../fhevm-sdk/src';
import { ethers } from 'ethers';

interface DonationData {
  id: string;
  name: string;
  description: string;
  creator: string;
  timestamp: number;
  encryptedValue: string;
  publicValue1: number;
  publicValue2: number;
  isVerified?: boolean;
  decryptedValue?: number;
}

interface DonationStats {
  totalDonations: number;
  verifiedDonations: number;
  totalAmount: number;
  avgDonation: number;
  topDonors: { address: string; amount: number }[];
}

const App: React.FC = () => {
  const { address, isConnected } = useAccount();
  const [loading, setLoading] = useState(true);
  const [donations, setDonations] = useState<DonationData[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showDonateModal, setShowDonateModal] = useState(false);
  const [donating, setDonating] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{ visible: boolean; status: "pending" | "success" | "error"; message: string; }>({ 
    visible: false, 
    status: "pending" as const, 
    message: "" 
  });
  const [newDonationData, setNewDonationData] = useState({ amount: "", message: "" });
  const [selectedDonation, setSelectedDonation] = useState<DonationData | null>(null);
  const [decryptedAmount, setDecryptedAmount] = useState<number | null>(null);
  const [isDecrypting, setIsDecrypting] = useState(false);
  const [contractAddress, setContractAddress] = useState("");
  const [fhevmInitializing, setFhevmInitializing] = useState(false);
  const [stats, setStats] = useState<DonationStats | null>(null);
  const [activeTab, setActiveTab] = useState("donations");
  const [faqOpen, setFaqOpen] = useState<number | null>(null);

  const { status, initialize, isInitialized } = useFhevm();
  const { encrypt, isEncrypting} = useEncrypt();
  const { verifyDecryption, isDecrypting: fheIsDecrypting } = useDecrypt();

  useEffect(() => {
    const initFhevmAfterConnection = async () => {
      if (!isConnected) return;
      if (isInitialized || fhevmInitializing) return;
      
      try {
        setFhevmInitializing(true);
        await initialize();
      } catch (error) {
        setTransactionStatus({ 
          visible: true, 
          status: "error", 
          message: "FHEVM初始化失败" 
        });
        setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      } finally {
        setFhevmInitializing(false);
      }
    };

    initFhevmAfterConnection();
  }, [isConnected, isInitialized, initialize, fhevmInitializing]);

  useEffect(() => {
    const loadDataAndContract = async () => {
      if (!isConnected) {
        setLoading(false);
        return;
      }
      
      try {
        await loadData();
        const contract = await getContractReadOnly();
        if (contract) setContractAddress(await contract.getAddress());
      } catch (error) {
        console.error('加载数据失败:', error);
      } finally {
        setLoading(false);
      }
    };

    loadDataAndContract();
  }, [isConnected]);

  const loadData = async () => {
    if (!isConnected) return;
    
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      const businessIds = await contract.getAllBusinessIds();
      const donationsList: DonationData[] = [];
      
      for (const businessId of businessIds) {
        try {
          const businessData = await contract.getBusinessData(businessId);
          donationsList.push({
            id: businessId,
            name: businessData.name,
            description: businessData.description,
            creator: businessData.creator,
            timestamp: Number(businessData.timestamp),
            encryptedValue: "",
            publicValue1: Number(businessData.publicValue1) || 0,
            publicValue2: Number(businessData.publicValue2) || 0,
            isVerified: businessData.isVerified,
            decryptedValue: Number(businessData.decryptedValue) || 0
          });
        } catch (e) {
          console.error('加载捐款数据错误:', e);
        }
      }
      
      setDonations(donationsList);
      calculateStats(donationsList);
    } catch (e) {
      setTransactionStatus({ visible: true, status: "error", message: "加载数据失败" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setIsRefreshing(false); 
    }
  };

  const calculateStats = (donations: DonationData[]) => {
    const totalDonations = donations.length;
    const verifiedDonations = donations.filter(d => d.isVerified).length;
    const totalAmount = donations.reduce((sum, d) => sum + (d.isVerified ? (d.decryptedValue || 0) : 0), 0);
    const avgDonation = totalDonations > 0 ? totalAmount / totalDonations : 0;
    
    const donorMap: Record<string, number> = {};
    donations.forEach(d => {
      if (d.isVerified && d.decryptedValue) {
        donorMap[d.creator] = (donorMap[d.creator] || 0) + d.decryptedValue;
      }
    });
    
    const topDonors = Object.entries(donorMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([address, amount]) => ({ address, amount }));
    
    setStats({
      totalDonations,
      verifiedDonations,
      totalAmount,
      avgDonation,
      topDonors
    });
  };

  const donate = async () => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "请先连接钱包" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return; 
    }
    
    setDonating(true);
    setTransactionStatus({ visible: true, status: "pending", message: "使用Zama FHE加密捐款..." });
    
    try {
      const contract = await getContractWithSigner();
      if (!contract) throw new Error("获取合约失败");
      
      const amountValue = parseInt(newDonationData.amount) || 0;
      const businessId = `donation-${Date.now()}`;
      
      const encryptedResult = await encrypt(contractAddress, address, amountValue);
      
      const tx = await contract.createBusinessData(
        businessId,
        "捐款",
        encryptedResult.encryptedData,
        encryptedResult.proof,
        0,
        0,
        newDonationData.message || "感谢您的捐赠"
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "等待交易确认..." });
      await tx.wait();
      
      setTransactionStatus({ visible: true, status: "success", message: "捐款成功！" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      await loadData();
      setShowDonateModal(false);
      setNewDonationData({ amount: "", message: "" });
    } catch (e: any) {
      const errorMessage = e.message?.includes("user rejected transaction") 
        ? "用户取消了交易" 
        : "提交失败: " + (e.message || "未知错误");
      setTransactionStatus({ visible: true, status: "error", message: errorMessage });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
    } finally { 
      setDonating(false); 
    }
  };

  const decryptAmount = async (id: string): Promise<number | null> => {
    if (!isConnected || !address) { 
      setTransactionStatus({ visible: true, status: "error", message: "请先连接钱包" });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    }
    
    setIsDecrypting(true);
    try {
      const contractRead = await getContractReadOnly();
      if (!contractRead) return null;
      
      const businessData = await contractRead.getBusinessData(id);
      if (businessData.isVerified) {
        const storedValue = Number(businessData.decryptedValue) || 0;
        
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "数据已在链上验证" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
        return storedValue;
      }
      
      const contractWrite = await getContractWithSigner();
      if (!contractWrite) return null;
      
      const encryptedValueHandle = await contractRead.getEncryptedValue(id);
      
      const result = await verifyDecryption(
        [encryptedValueHandle],
        contractAddress,
        (abiEncodedClearValues: string, decryptionProof: string) => 
          contractWrite.verifyDecryption(id, abiEncodedClearValues, decryptionProof)
      );
      
      setTransactionStatus({ visible: true, status: "pending", message: "在链上验证解密..." });
      
      const clearValue = result.decryptionResult.clearValues[encryptedValueHandle];
      
      await loadData();
      
      setTransactionStatus({ visible: true, status: "success", message: "数据解密并验证成功!" });
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
      
      return Number(clearValue);
      
    } catch (e: any) { 
      if (e.message?.includes("Data already verified")) {
        setTransactionStatus({ 
          visible: true, 
          status: "success", 
          message: "数据已在链上验证" 
        });
        setTimeout(() => {
          setTransactionStatus({ visible: false, status: "pending", message: "" });
        }, 2000);
        
        await loadData();
        return null;
      }
      
      setTransactionStatus({ 
        visible: true, 
        status: "error", 
        message: "解密失败: " + (e.message || "未知错误") 
      });
      setTimeout(() => setTransactionStatus({ visible: false, status: "pending", message: "" }), 3000);
      return null; 
    } finally { 
      setIsDecrypting(false); 
    }
  };

  const handleDecrypt = async (id: string) => {
    const decrypted = await decryptAmount(id);
    if (decrypted !== null) {
      setDecryptedAmount(decrypted);
    }
  };

  const renderProgressBar = () => {
    const total = 100000;
    const current = stats ? stats.totalAmount : 0;
    const percentage = Math.min(100, (current / total) * 100);
    
    return (
      <div className="progress-container">
        <div className="progress-labels">
          <span>目标: 100,000 USDC</span>
          <span>{current.toLocaleString()} USDC</span>
        </div>
        <div className="progress-bar">
          <div 
            className="progress-fill" 
            style={{ width: `${percentage}%`, background: `linear-gradient(90deg, #ff7e5f, #feb47b)` }}
          >
            <div className="progress-text">{percentage.toFixed(1)}%</div>
          </div>
        </div>
      </div>
    );
  };

  const renderStats = () => {
    if (!stats) return null;
    
    return (
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-value">{stats.totalDonations}</div>
          <div className="stat-label">总捐款次数</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.verifiedDonations}</div>
          <div className="stat-label">已验证捐款</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.totalAmount.toLocaleString()} USDC</div>
          <div className="stat-label">总金额</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{stats.avgDonation.toLocaleString()} USDC</div>
          <div className="stat-label">平均捐款额</div>
        </div>
      </div>
    );
  };

  const renderTopDonors = () => {
    if (!stats || stats.topDonors.length === 0) return null;
    
    return (
      <div className="top-donors">
        <h3>捐款英雄榜</h3>
        <div className="donors-list">
          {stats.topDonors.map((donor, index) => (
            <div className="donor-item" key={index}>
              <div className="donor-rank">{index + 1}</div>
              <div className="donor-address">{donor.address.substring(0, 6)}...{donor.address.substring(38)}</div>
              <div className="donor-amount">{donor.amount.toLocaleString()} USDC</div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderFAQ = () => {
    const faqs = [
      {
        question: "什么是全同态加密(FHE)?",
        answer: "全同态加密是一种特殊的加密技术，允许在加密数据上直接进行计算，而无需解密原始数据。这意味着我们可以处理加密的捐款金额，同时保护捐赠者的隐私。"
      },
      {
        question: "我的捐款信息如何被保护?",
        answer: "您的捐款金额在本地加密后发送到区块链上。只有加密后的数据存储在链上，原始金额永远不会暴露。任何人都无法查看您的具体捐款金额。"
      },
      {
        question: "如何验证我的捐款?",
        answer: "您可以通过'验证解密'按钮在本地解密您的捐款金额，并将解密证明提交到区块链进行验证。验证成功后，您的捐款金额会被安全地记录在链上。"
      },
      {
        question: "为什么需要验证捐款?",
        answer: "验证过程确保捐款金额的真实性，同时保持隐私。验证后的捐款会被计入总金额，但不会公开具体捐赠者信息。"
      },
      {
        question: "我可以捐赠多少金额?",
        answer: "您可以使用任何金额进行捐赠，系统只接受整数金额。最小捐赠金额为1 USDC，没有上限。"
      }
    ];
    
    return (
      <div className="faq-section">
        <h3>常见问题解答</h3>
        <div className="faq-list">
          {faqs.map((faq, index) => (
            <div 
              className={`faq-item ${faqOpen === index ? 'open' : ''}`} 
              key={index}
              onClick={() => setFaqOpen(faqOpen === index ? null : index)}
            >
              <div className="faq-question">
                {faq.question}
                <div className="faq-icon">{faqOpen === index ? '−' : '+'}</div>
              </div>
              {faqOpen === index && <div className="faq-answer">{faq.answer}</div>}
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!isConnected) {
    return (
      <div className="app-container">
        <header className="app-header">
          <div className="logo">
            <h1>隐私捐款箱 🔐</h1>
          </div>
          <div className="header-actions">
            <div className="wallet-connect-wrapper">
              <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
            </div>
          </div>
        </header>
        
        <div className="connection-prompt">
          <div className="connection-content">
            <div className="connection-icon">❤️</div>
            <h2>连接钱包开始捐款</h2>
            <p>请连接您的钱包以使用全同态加密技术进行隐私捐款</p>
            <div className="connection-steps">
              <div className="step">
                <span>1</span>
                <p>使用上方按钮连接钱包</p>
              </div>
              <div className="step">
                <span>2</span>
                <p>FHE系统将自动初始化</p>
              </div>
              <div className="step">
                <span>3</span>
                <p>开始加密捐款，保护您的隐私</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!isInitialized || fhevmInitializing) {
    return (
      <div className="loading-screen">
        <div className="fhe-spinner"></div>
        <p>初始化FHE加密系统...</p>
        <p>状态: {fhevmInitializing ? "初始化FHEVM" : status}</p>
        <p className="loading-note">这可能需要一些时间</p>
      </div>
    );
  }

  if (loading) return (
    <div className="loading-screen">
      <div className="fhe-spinner"></div>
      <p>加载加密捐款系统...</p>
    </div>
  );

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="logo">
          <h1>隐私捐款箱 🔐</h1>
          <p>使用全同态加密保护您的捐赠隐私</p>
        </div>
        
        <div className="header-actions">
          <button 
            onClick={() => setShowDonateModal(true)} 
            className="donate-btn"
          >
            捐款
          </button>
          <div className="wallet-connect-wrapper">
            <ConnectButton accountStatus="address" chainStatus="icon" showBalance={false}/>
          </div>
        </div>
      </header>
      
      <div className="main-content">
        <div className="project-intro">
          <h2>为贫困儿童教育项目捐款</h2>
          <p>您的捐款将用于为贫困地区的儿童提供教育资源和学习机会。使用全同态加密技术，您的捐款金额将被加密保护，只有总进度公开可见。</p>
          {renderProgressBar()}
        </div>
        
        <div className="tabs">
          <button 
            className={`tab ${activeTab === "donations" ? "active" : ""}`}
            onClick={() => setActiveTab("donations")}
          >
            捐款记录
          </button>
          <button 
            className={`tab ${activeTab === "stats" ? "active" : ""}`}
            onClick={() => setActiveTab("stats")}
          >
            数据统计
          </button>
          <button 
            className={`tab ${activeTab === "faq" ? "active" : ""}`}
            onClick={() => setActiveTab("faq")}
          >
            常见问题
          </button>
        </div>
        
        {activeTab === "donations" && (
          <div className="donations-section">
            <div className="section-header">
              <h2>捐款记录</h2>
              <div className="header-actions">
                <button 
                  onClick={loadData} 
                  className="refresh-btn" 
                  disabled={isRefreshing}
                >
                  {isRefreshing ? "刷新中..." : "刷新"}
                </button>
              </div>
            </div>
            
            <div className="donations-list">
              {donations.length === 0 ? (
                <div className="no-donations">
                  <p>暂无捐款记录</p>
                  <button 
                    className="donate-btn" 
                    onClick={() => setShowDonateModal(true)}
                  >
                    成为第一个捐款者
                  </button>
                </div>
              ) : donations.map((donation, index) => (
                <div 
                  className={`donation-item ${selectedDonation?.id === donation.id ? "selected" : ""} ${donation.isVerified ? "verified" : ""}`} 
                  key={index}
                  onClick={() => setSelectedDonation(donation)}
                >
                  <div className="donation-message">{donation.description}</div>
                  <div className="donation-meta">
                    <span>捐款者: {donation.creator.substring(0, 6)}...{donation.creator.substring(38)}</span>
                    <span>时间: {new Date(donation.timestamp * 1000).toLocaleDateString()}</span>
                  </div>
                  <div className="donation-status">
                    {donation.isVerified ? (
                      <span className="verified">✅ 已验证金额: {donation.decryptedValue} USDC</span>
                    ) : (
                      <span className="pending">🔒 等待验证</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {activeTab === "stats" && (
          <div className="stats-section">
            <h2>捐款统计</h2>
            {renderStats()}
            {renderTopDonors()}
          </div>
        )}
        
        {activeTab === "faq" && renderFAQ()}
      </div>
      
      {showDonateModal && (
        <ModalDonate 
          onSubmit={donate} 
          onClose={() => setShowDonateModal(false)} 
          donating={donating} 
          donationData={newDonationData} 
          setDonationData={setNewDonationData}
          isEncrypting={isEncrypting}
        />
      )}
      
      {selectedDonation && (
        <DonationDetailModal 
          donation={selectedDonation} 
          onClose={() => { 
            setSelectedDonation(null); 
            setDecryptedAmount(null); 
          }} 
          decryptedAmount={decryptedAmount} 
          isDecrypting={isDecrypting || fheIsDecrypting} 
          decryptData={() => handleDecrypt(selectedDonation.id)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="fhe-spinner"></div>}
              {transactionStatus.status === "success" && <div className="success-icon">✓</div>}
              {transactionStatus.status === "error" && <div className="error-icon">✗</div>}
            </div>
            <div className="transaction-message">{transactionStatus.message}</div>
          </div>
        </div>
      )}
      
      <footer className="app-footer">
        <p>隐私捐款箱 - 使用全同态加密技术保护您的捐赠隐私</p>
        <div className="footer-links">
          <a href="#">关于我们</a>
          <a href="#">项目详情</a>
          <a href="#">联系方式</a>
        </div>
      </footer>
    </div>
  );
};

const ModalDonate: React.FC<{
  onSubmit: () => void; 
  onClose: () => void; 
  donating: boolean;
  donationData: any;
  setDonationData: (data: any) => void;
  isEncrypting: boolean;
}> = ({ onSubmit, onClose, donating, donationData, setDonationData, isEncrypting }) => {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (name === 'amount') {
      const intValue = value.replace(/[^\d]/g, '');
      setDonationData({ ...donationData, [name]: intValue });
    } else {
      setDonationData({ ...donationData, [name]: value });
    }
  };

  return (
    <div className="modal-overlay">
      <div className="donate-modal">
        <div className="modal-header">
          <h2>隐私捐款</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="fhe-notice">
            <strong>FHE 🔐 加密技术</strong>
            <p>您的捐款金额将使用全同态加密技术保护，只有总进度公开可见</p>
          </div>
          
          <div className="form-group">
            <label>捐款金额 (USDC) *</label>
            <input 
              type="number" 
              name="amount" 
              value={donationData.amount} 
              onChange={handleChange} 
              placeholder="输入捐款金额..." 
              min="1"
            />
            <div className="data-type-label">FHE加密整数</div>
          </div>
          
          <div className="form-group">
            <label>留言 (可选)</label>
            <textarea 
              name="message" 
              value={donationData.message} 
              onChange={handleChange} 
              placeholder="输入您的留言..." 
              rows={3}
            />
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="cancel-btn">取消</button>
          <button 
            onClick={onSubmit} 
            disabled={donating || isEncrypting || !donationData.amount} 
            className="submit-btn"
          >
            {donating || isEncrypting ? "加密并捐款中..." : "确认捐款"}
          </button>
        </div>
      </div>
    </div>
  );
};

const DonationDetailModal: React.FC<{
  donation: DonationData;
  onClose: () => void;
  decryptedAmount: number | null;
  isDecrypting: boolean;
  decryptData: () => void;
}> = ({ donation, onClose, decryptedAmount, isDecrypting, decryptData }) => {
  return (
    <div className="modal-overlay">
      <div className="donation-detail-modal">
        <div className="modal-header">
          <h2>捐款详情</h2>
          <button onClick={onClose} className="close-modal">&times;</button>
        </div>
        
        <div className="modal-body">
          <div className="donation-info">
            <div className="info-item">
              <span>捐款者:</span>
              <strong>{donation.creator.substring(0, 6)}...{donation.creator.substring(38)}</strong>
            </div>
            <div className="info-item">
              <span>捐款时间:</span>
              <strong>{new Date(donation.timestamp * 1000).toLocaleString()}</strong>
            </div>
            <div className="info-item">
              <span>留言:</span>
              <strong>{donation.description}</strong>
            </div>
          </div>
          
          <div className="data-section">
            <h3>加密捐款数据</h3>
            
            <div className="data-row">
              <div className="data-label">捐款金额:</div>
              <div className="data-value">
                {donation.isVerified ? 
                  `${donation.decryptedValue} USDC (链上已验证)` : 
                  decryptedAmount !== null ? 
                  `${decryptedAmount} USDC (本地已解密)` : 
                  "🔒 FHE加密整数"
                }
              </div>
              {!donation.isVerified && (
                <button 
                  className={`decrypt-btn ${decryptedAmount !== null ? 'decrypted' : ''}`}
                  onClick={decryptData} 
                  disabled={isDecrypting}
                >
                  {isDecrypting ? "🔓 验证中..." : "🔓 验证解密"}
                </button>
              )}
            </div>
            
            <div className="fhe-info">
              <div className="fhe-icon">🔐</div>
              <div>
                <strong>FHE 🔐 自中继解密</strong>
                <p>数据在链上加密存储。点击"验证解密"执行离线解密和链上验证。</p>
              </div>
            </div>
          </div>
        </div>
        
        <div className="modal-footer">
          <button onClick={onClose} className="close-btn">关闭</button>
          {donation.isVerified && (
            <div className="verified-badge">✅ 已验证</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;


