'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard';
import { Button } from '@/components/ui';
import {

    Building2, ArrowLeft, User, Mail, Phone, CreditCard, FileText, Shield, Car, Edit,
    Check, X, Save, ExternalLink, AlertTriangle, Clock, Briefcase, Lock,
    CheckCircle, XCircle, Upload, Trash2, Eye, Calendar, ChevronDown, Award, Plus, Image as ImageIcon, Search
} from 'lucide-react';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

const LICENSE_CATEGORIES = [
    { code: 'AM', icon: '🛵' }, { code: 'A1', icon: '🏍️' }, { code: 'A2', icon: '🏍️' }, { code: 'A', icon: '🏍️' },
    { code: 'B1', icon: '🚗' }, { code: 'B', icon: '🚗' }, { code: 'C1', icon: '🚛' }, { code: 'C', icon: '🚛' },
    { code: 'D1', icon: '🚌' }, { code: 'D', icon: '🚌' }, { code: 'BE', icon: '🚗' }, { code: 'C1E', icon: '🚛' },
    { code: 'CE', icon: '🚛' }, { code: 'D1E', icon: '🚌' }, { code: 'DE', icon: '🚌' }, { code: 'T', icon: '🚜' }
];
const COUNTRIES = ['Netherlands', 'Germany', 'Belgium', 'France', 'United Kingdom', 'Spain', 'Italy', 'Poland', 'Turkey', 'Morocco', 'Syria', 'Iraq', 'Other'];

// Comprehensive list of nationalities with country flags
const NATIONALITIES = [
    { name: 'Netherlands', flag: '🇳🇱' },
    { name: 'Germany', flag: '🇩🇪' },
    { name: 'Belgium', flag: '🇧🇪' },
    { name: 'France', flag: '🇫🇷' },
    { name: 'United Kingdom', flag: '🇬🇧' },
    { name: 'Spain', flag: '🇪🇸' },
    { name: 'Italy', flag: '🇮🇹' },
    { name: 'Poland', flag: '🇵🇱' },
    { name: 'Portugal', flag: '🇵🇹' },
    { name: 'Greece', flag: '🇬🇷' },
    { name: 'Romania', flag: '🇷🇴' },
    { name: 'Bulgaria', flag: '🇧🇬' },
    { name: 'Hungary', flag: '🇭🇺' },
    { name: 'Czech Republic', flag: '🇨🇿' },
    { name: 'Austria', flag: '🇦🇹' },
    { name: 'Sweden', flag: '🇸🇪' },
    { name: 'Denmark', flag: '🇩🇰' },
    { name: 'Finland', flag: '🇫🇮' },
    { name: 'Norway', flag: '🇳🇴' },
    { name: 'Ireland', flag: '🇮🇪' },
    { name: 'Switzerland', flag: '🇨🇭' },
    { name: 'Turkey', flag: '🇹🇷' },
    { name: 'Morocco', flag: '🇲🇦' },
    { name: 'Algeria', flag: '🇩🇿' },
    { name: 'Tunisia', flag: '🇹🇳' },
    { name: 'Egypt', flag: '🇪🇬' },
    { name: 'Libya', flag: '🇱🇾' },
    { name: 'Syria', flag: '🇸🇾' },
    { name: 'Iraq', flag: '🇮🇶' },
    { name: 'Iran', flag: '🇮🇷' },
    { name: 'Lebanon', flag: '🇱🇧' },
    { name: 'Jordan', flag: '🇯🇴' },
    { name: 'Palestine', flag: '🇵🇸' },
    { name: 'Saudi Arabia', flag: '🇸🇦' },
    { name: 'United Arab Emirates', flag: '🇦🇪' },
    { name: 'Kuwait', flag: '🇰🇼' },
    { name: 'Qatar', flag: '🇶🇦' },
    { name: 'Oman', flag: '🇴🇲' },
    { name: 'Bahrain', flag: '🇧🇭' },
    { name: 'Yemen', flag: '🇾🇪' },
    { name: 'Afghanistan', flag: '🇦🇫' },
    { name: 'Pakistan', flag: '🇵🇰' },
    { name: 'India', flag: '🇮🇳' },
    { name: 'Bangladesh', flag: '🇧🇩' },
    { name: 'Sri Lanka', flag: '🇱🇰' },
    { name: 'Nepal', flag: '🇳🇵' },
    { name: 'China', flag: '🇨🇳' },
    { name: 'Japan', flag: '🇯🇵' },
    { name: 'South Korea', flag: '🇰🇷' },
    { name: 'Vietnam', flag: '🇻🇳' },
    { name: 'Thailand', flag: '🇹🇭' },
    { name: 'Philippines', flag: '🇵🇭' },
    { name: 'Indonesia', flag: '🇮🇩' },
    { name: 'Malaysia', flag: '🇲🇾' },
    { name: 'Singapore', flag: '🇸🇬' },
    { name: 'Russia', flag: '🇷🇺' },
    { name: 'Ukraine', flag: '🇺🇦' },
    { name: 'Belarus', flag: '🇧🇾' },
    { name: 'Kazakhstan', flag: '🇰🇿' },
    { name: 'Uzbekistan', flag: '🇺🇿' },
    { name: 'Azerbaijan', flag: '🇦🇿' },
    { name: 'Georgia', flag: '🇬🇪' },
    { name: 'Armenia', flag: '🇦🇲' },
    { name: 'United States', flag: '🇺🇸' },
    { name: 'Canada', flag: '🇨🇦' },
    { name: 'Mexico', flag: '🇲🇽' },
    { name: 'Brazil', flag: '🇧🇷' },
    { name: 'Argentina', flag: '🇦🇷' },
    { name: 'Colombia', flag: '🇨🇴' },
    { name: 'Peru', flag: '🇵🇪' },
    { name: 'Chile', flag: '🇨🇱' },
    { name: 'Venezuela', flag: '🇻🇪' },
    { name: 'Ecuador', flag: '🇪🇨' },
    { name: 'Cuba', flag: '🇨🇺' },
    { name: 'South Africa', flag: '🇿🇦' },
    { name: 'Nigeria', flag: '🇳🇬' },
    { name: 'Ghana', flag: '🇬🇭' },
    { name: 'Kenya', flag: '🇰🇪' },
    { name: 'Ethiopia', flag: '🇪🇹' },
    { name: 'Somalia', flag: '🇸🇴' },
    { name: 'Eritrea', flag: '🇪🇷' },
    { name: 'Sudan', flag: '🇸🇩' },
    { name: 'Cameroon', flag: '🇨🇲' },
    { name: 'Congo', flag: '🇨🇬' },
    { name: 'Senegal', flag: '🇸🇳' },
    { name: 'Australia', flag: '🇦🇺' },
    { name: 'New Zealand', flag: '🇳🇿' },
    { name: 'Stateless', flag: '🏳️' },
    { name: 'Other', flag: '🌍' },
];

const DOCUMENT_TYPES = [{ id: 1, name: 'Passport' }, { id: 2, name: 'ID Card' }, { id: 3, name: 'Residence Permit' }];


interface EmployeeDetail {
    id: string;
    user: { id: string; email: string; first_name: string; last_name: string; role: string; };
    status: string;
    first_name: string;
    last_name: string;
    prefix_name: string;
    full_name: string;
    initials: string;
    gender: string;
    date_of_birth: string;
    birthplace: string;
    nationality: string;
    bsn: string;
    phone_number: string;
    street_address: string;
    street_name: string;
    house_number: string;
    house_number_addition: string;
    postcode: string;
    city: string;
    iban: string;
    hourly_rate: string;
    document_type_name: string;
    document_type_id: number;
    document_number: string;
    document_issue_date: string;
    document_expiry_date: string;
    has_drivers_license: boolean;
    drivers_license_number: string;
    drivers_license_issue_date: string;
    drivers_license_expiry_date: string;
    drivers_license_categories: string[];
    contract_type_id: number | null;
    current_agency_id: number | null;
    contract_phase: string;
    contract_start_date: string;
    contract_end_date: string;
    contract_document_url: string | null;
    rejection_reason: string;
    submitted_at: string;
    approved_at: string;
    created_at: string;
    id_document_front_url: string | null;
    id_document_back_url: string | null;
    id_document_pdf_url: string | null;
    drivers_license_front_url: string | null;
    drivers_license_back_url: string | null;
    // Travel fields
    has_travel_allowance: boolean;
    travel_cost_per_km: string | null;
    travel_hour_percentage: string | null;
    // Permission fields
    can_add_allowances: boolean;
    receives_surcharges: boolean;
}

type TabType = 'overview' | 'documents' | 'contract' | 'certificates';

// Certificate Types
interface CertificateType {
    id: number;
    name: string;
    description: string;
    is_active: boolean;
    is_required: boolean;
    has_expiry: boolean;
    has_diploma_number: boolean;
}

interface EmployeeCertificate {
    id: number;
    employee: number;
    certificate_type: number;
    certificate_type_name: string;
    certificate_file: string;
    certificate_file_back?: string | null;
    diploma_number: string;
    expiry_date: string | null;
    issue_date: string | null;
    status: string;
    is_expired: boolean;
    days_until_expiry: number | null;
    created_at: string;
}

interface RateHistory {
    id: number;
    hourly_rate: string;
    effective_from: string;
    effective_to: string | null;
    changed_by_name: string;
    notes: string;
    created_at: string;
}

interface ContractHistory {
    id: number;
    contract_document_url: string;
    hourly_rate: string;
    effective_from: string;
    effective_to: string | null;
    notes: string;
    uploaded_by_name: string;
    created_at: string;
}

export default function EmployeeDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [employee, setEmployee] = useState<EmployeeDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [activeTab, setActiveTab] = useState<TabType>('overview');
    const [isEditing, setIsEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [editForm, setEditForm] = useState<Partial<EmployeeDetail>>({});
    const [showApproveModal, setShowApproveModal] = useState(false);
    const [showRejectModal, setShowRejectModal] = useState(false);
    // Rate History State
    const [rateHistory, setRateHistory] = useState<RateHistory[]>([]);
    // Contract History State
    const [contractHistory, setContractHistory] = useState<ContractHistory[]>([]);
    // Rate Change Contract Modal
    const [showRateChangeModal, setShowRateChangeModal] = useState(false);
    const [pendingRateChange, setPendingRateChange] = useState<string | null>(null);
    const [newContractFile, setNewContractFile] = useState<File | null>(null);

    const [rejectReason, setRejectReason] = useState('');
    const [approvalData, setApprovalData] = useState({ contract_phase: 'phase_a', contract_start_date: '', contract_end_date: '', contract_type_id: '', agency_id: '' });
    const [noPermission, setNoPermission] = useState(false);
    const [uploadingFile, setUploadingFile] = useState<string | null>(null);
    const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
    const [contractTypes, setContractTypes] = useState<{ id: number; name: string; code: string; requires_end_date: boolean; requires_agency: boolean }[]>([]);
    const [agencies, setAgencies] = useState<{ id: number; name: string; code: string }[]>([]);
    const [contractDataLoading, setContractDataLoading] = useState(false);
    const [contractDataError, setContractDataError] = useState<string | null>(null);
    const [contractDataLoaded, setContractDataLoaded] = useState(false);
    const [showTransferModal, setShowTransferModal] = useState(false);
    const [transferData, setTransferData] = useState({ agency_id: '', start_date: '', notes: '' });

    // Certificate states
    const [employeeCertificates, setEmployeeCertificates] = useState<EmployeeCertificate[]>([]);
    const [certificateTypes, setCertificateTypes] = useState<CertificateType[]>([]);
    const [certificatesLoading, setCertificatesLoading] = useState(false);
    const [certificatesLoaded, setCertificatesLoaded] = useState(false);
    const [showAddCertificateModal, setShowAddCertificateModal] = useState(false);
    const [showViewCertificateModal, setShowViewCertificateModal] = useState(false);
    const [selectedCertificate, setSelectedCertificate] = useState<EmployeeCertificate | null>(null);
    const [certificateForm, setCertificateForm] = useState({ certificate_type_id: '', diploma_number: '', expiry_date: '', issue_date: '' });
    const [certificateFile, setCertificateFile] = useState<File | null>(null);
    const [certificateFileBack, setCertificateFileBack] = useState<File | null>(null);
    const [uploadMode, setUploadMode] = useState<'pdf' | 'images'>('pdf');
    const [savingCertificate, setSavingCertificate] = useState(false);

    // Nationality dropdown state
    const [nationalitySearch, setNationalitySearch] = useState('');
    const [nationalityDropdownOpen, setNationalityDropdownOpen] = useState(false);
    const nationalityDropdownRef = useRef<HTMLDivElement>(null);

    // Close nationality dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (nationalityDropdownRef.current && !nationalityDropdownRef.current.contains(event.target as Node)) {
                setNationalityDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Postcode lookup state
    const [postcodeLookupLoading, setPostcodeLookupLoading] = useState(false);
    const [postcodeSuggestions, setPostcodeSuggestions] = useState<{ street: string; city: string; municipality?: string }[]>([]);
    const [showPostcodeSuggestions, setShowPostcodeSuggestions] = useState(false);
    const postcodeDropdownRef = useRef<HTMLDivElement>(null);

    // Lookup Dutch address by postcode
    const lookupPostcode = async (postcode: string) => {
        // Dutch postcode format: 4 digits + 2 letters (e.g., 1234AB or 1234 AB)
        const cleanPostcode = postcode.replace(/\s/g, '').toUpperCase();
        const postcodeRegex = /^[1-9][0-9]{3}[A-Z]{2}$/;

        if (!postcodeRegex.test(cleanPostcode)) {
            setPostcodeSuggestions([]);
            setShowPostcodeSuggestions(false);
            return;
        }

        setPostcodeLookupLoading(true);
        try {
            // Use PDOK Locatieserver API (Official Dutch Government API - free, CORS-enabled)
            // Fetch addresses to get street names - use 'adres' type for street-level data
            const formattedPostcode = cleanPostcode.slice(0, 4) + ' ' + cleanPostcode.slice(4);
            const response = await fetch(
                `https://api.pdok.nl/bzk/locatieserver/search/v3_1/free?q=postcode:${formattedPostcode}&fq=type:adres&rows=50`,
                {
                    headers: {
                        'Accept': 'application/json',
                    }
                }
            );

            if (response.ok) {
                const data = await response.json();
                if (data?.response?.docs && data.response.docs.length > 0) {
                    // Get unique streets from the addresses
                    const streetMap = new Map<string, { street: string; city: string; municipality: string }>();

                    data.response.docs.forEach((doc: {
                        straatnaam?: string;
                        woonplaatsnaam?: string;
                        gemeentenaam?: string;
                        postcode?: string;
                    }) => {
                        const street = doc.straatnaam || '';
                        const city = doc.woonplaatsnaam || doc.gemeentenaam || '';
                        if (street && city && !streetMap.has(street)) {
                            streetMap.set(street, {
                                street,
                                city,
                                municipality: doc.gemeentenaam || '',
                            });
                        }
                    });

                    const suggestions = Array.from(streetMap.values());

                    if (suggestions.length > 0) {
                        setPostcodeSuggestions(suggestions);
                        setShowPostcodeSuggestions(true);
                        setPostcodeLookupLoading(false);
                        return;
                    }
                }
            }

            // Fallback: Try with different PDOK endpoint (address search)
            const fallbackResponse = await fetch(
                `https://api.pdok.nl/bzk/locatieserver/search/v3_1/suggest?q=${formattedPostcode}`,
                {
                    headers: { 'Accept': 'application/json' }
                }
            );

            if (fallbackResponse.ok) {
                const fallbackData = await fallbackResponse.json();
                if (fallbackData?.response?.docs && fallbackData.response.docs.length > 0) {
                    const suggestions = fallbackData.response.docs
                        .filter((doc: { type: string }) => doc.type === 'postcode' || doc.type === 'adres')
                        .slice(0, 5)
                        .map((doc: {
                            straatnaam?: string;
                            woonplaatsnaam?: string;
                            gemeentenaam?: string;
                            weergavenaam?: string;
                        }) => ({
                            street: doc.straatnaam || '',
                            city: doc.woonplaatsnaam || doc.gemeentenaam || '',
                            municipality: doc.gemeentenaam || '',
                        }));

                    if (suggestions.length > 0) {
                        setPostcodeSuggestions(suggestions);
                        setShowPostcodeSuggestions(true);
                        setPostcodeLookupLoading(false);
                        return;
                    }
                }
            }

            // Last fallback: Use postcode range mapping for city only
            const postcodeFirstTwo = parseInt(cleanPostcode.slice(0, 2));
            let city = '';

            // Major Dutch cities by postcode range
            if (postcodeFirstTwo >= 10 && postcodeFirstTwo <= 11) city = 'Amsterdam';
            else if (postcodeFirstTwo === 12) city = 'Haarlem';
            else if (postcodeFirstTwo === 13) city = 'Amstelveen';
            else if (postcodeFirstTwo === 14) city = 'Hoofddorp';
            else if (postcodeFirstTwo === 15) city = 'Purmerend';
            else if (postcodeFirstTwo === 16) city = 'Zaandam';
            else if (postcodeFirstTwo === 17) city = 'Heerhugowaard';
            else if (postcodeFirstTwo === 18) city = 'Alkmaar';
            else if (postcodeFirstTwo === 19) city = 'Den Helder';
            else if (postcodeFirstTwo === 20 || postcodeFirstTwo === 23) city = 'Den Haag';
            else if (postcodeFirstTwo === 21) city = 'Wassenaar';
            else if (postcodeFirstTwo === 22) city = 'Leidschendam';
            else if (postcodeFirstTwo === 24 || postcodeFirstTwo === 25) city = 'Leiden';
            else if (postcodeFirstTwo === 26) city = 'Noordwijk';
            else if (postcodeFirstTwo === 27 || postcodeFirstTwo === 28) city = 'Gouda';
            else if (postcodeFirstTwo === 29) city = 'Zoetermeer';
            else if (postcodeFirstTwo === 30 || postcodeFirstTwo === 31) city = 'Rotterdam';
            else if (postcodeFirstTwo === 32) city = 'Dordrecht';
            else if (postcodeFirstTwo === 33) city = 'Papendrecht';
            else if (postcodeFirstTwo === 34) city = 'Gorinchem';
            else if (postcodeFirstTwo === 35) city = 'Hilversum';
            else if (postcodeFirstTwo === 36) city = 'Almere';
            else if (postcodeFirstTwo === 37 || postcodeFirstTwo === 38) city = 'Amersfoort';
            else if (postcodeFirstTwo === 39) city = 'Zeist';
            else if (postcodeFirstTwo >= 40 && postcodeFirstTwo <= 41) city = 'Eindhoven';
            else if (postcodeFirstTwo >= 50 && postcodeFirstTwo <= 51) city = 'Eindhoven';
            else if (postcodeFirstTwo === 52 || postcodeFirstTwo === 53) city = 'Tilburg';
            else if (postcodeFirstTwo === 54 || postcodeFirstTwo === 65) city = 'Breda';
            else if (postcodeFirstTwo >= 60 && postcodeFirstTwo <= 62) city = 'Maastricht';
            else if (postcodeFirstTwo === 63) city = 'Heerlen';
            else if (postcodeFirstTwo >= 70 && postcodeFirstTwo <= 73) city = 'Enschede';
            else if (postcodeFirstTwo >= 80 && postcodeFirstTwo <= 81) city = 'Zwolle';
            else if (postcodeFirstTwo === 82) city = 'Lelystad';
            else if (postcodeFirstTwo >= 90 && postcodeFirstTwo <= 91) city = 'Groningen';
            else if (postcodeFirstTwo >= 95 && postcodeFirstTwo <= 96) city = 'Leeuwarden';

            if (city) {
                setPostcodeSuggestions([{ street: '', city, municipality: city }]);
                setShowPostcodeSuggestions(true);
            } else {
                setPostcodeSuggestions([]);
                setShowPostcodeSuggestions(false);
            }
        } catch (error) {
            console.error('Postcode lookup error:', error);
            setPostcodeSuggestions([]);
        } finally {
            setPostcodeLookupLoading(false);
        }
    };

    // Close postcode dropdown when clicking outside
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (postcodeDropdownRef.current && !postcodeDropdownRef.current.contains(event.target as Node)) {
                setShowPostcodeSuggestions(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    useEffect(() => { loadEmployee(); }, [params.id]);

    useEffect(() => {
        if (employee) {
            loadRateHistory();
            loadContractHistory();
        }
    }, [employee]);

    async function loadRateHistory() {
        try {
            const response = await fetch(`${API_URL}/employees/profiles/${params.id}/rate_history/`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                },
            });
            if (response.ok) {
                setRateHistory(await response.json());
            }
        } catch (e) {
            console.error('Failed to load rate history', e);
        }
    }

    async function loadContractHistory() {
        try {
            const response = await fetch(`${API_URL}/employees/profiles/${params.id}/contract_history/`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                },
            });
            if (response.ok) {
                setContractHistory(await response.json());
            }
        } catch (e) {
            console.error('Failed to load contract history', e);
        }
    }

    // Load contract data only when Contract tab is clicked (once)
    useEffect(() => {
        if (activeTab === 'contract' && !contractDataLoaded && !contractDataLoading) {
            loadContractTypesAndAgencies();
        }
    }, [activeTab, contractDataLoaded, contractDataLoading]);

    // Load certificates when Certificates tab is clicked
    useEffect(() => {
        if (activeTab === 'certificates' && !certificatesLoaded && !certificatesLoading && employee) {
            loadCertificates();
        }
    }, [activeTab, certificatesLoaded, certificatesLoading, employee]);

    async function loadCertificates() {
        if (!employee) return;
        setCertificatesLoading(true);
        try {
            // Load employee's certificates
            const certsResponse = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/certificates/employee-certificates/?employee=${employee.id}`,
                { headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` } }
            );
            if (certsResponse.ok) {
                const certsData = await certsResponse.json();
                setEmployeeCertificates(certsData.results || certsData || []);
            }

            // Load certificate types
            const typesResponse = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/certificates/types/active/`,
                { headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` } }
            );
            if (typesResponse.ok) {
                const typesData = await typesResponse.json();
                setCertificateTypes(typesData.results || typesData || []);
            }

            setCertificatesLoaded(true);
        } catch (err) {
            console.error('Failed to load certificates:', err);
        } finally {
            setCertificatesLoading(false);
        }
    }


    async function loadEmployee() {
        try {
            setLoading(true);
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/employees/profiles/${params.id}/`,
                { headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` } }
            );
            if (response.status === 403) { setNoPermission(true); return; }
            if (!response.ok) throw new Error('Failed to load');
            const data = await response.json();
            setEmployee(data);
            setEditForm(data);
            setSelectedCategories(data.drivers_license_categories || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed');
        } finally {
            setLoading(false);
        }
    }

    async function loadContractTypesAndAgencies() {
        setContractDataLoading(true);
        setContractDataError(null);
        try {
            const token = localStorage.getItem('access_token') || localStorage.getItem('accessToken');
            const API_URL = 'http://localhost:8000/api';
            const [ctRes, agRes] = await Promise.all([
                fetch(`${API_URL}/employees/contract-types/`, { headers: { 'Authorization': `Bearer ${token}` } }),
                fetch(`${API_URL}/employees/agencies/`, { headers: { 'Authorization': `Bearer ${token}` } }),
            ]);

            if (!ctRes.ok) throw new Error(`Contract types failed: ${ctRes.status}`);
            if (!agRes.ok) throw new Error(`Agencies failed: ${agRes.status}`);

            const ctData = await ctRes.json();
            const agData = await agRes.json();

            const ctArray = Array.isArray(ctData) ? ctData : (ctData.results || []);
            const agArray = Array.isArray(agData) ? agData : (agData.results || []);

            setContractTypes(ctArray);
            setAgencies(agArray);
            setContractDataLoaded(true);
        } catch (e) {
            console.error('Failed to load contract data:', e);
            setContractDataError(e instanceof Error ? e.message : 'Failed to load contract data');
        } finally {
            setContractDataLoading(false);
        }
    }

    async function handleSaveEdit() {
        if (!employee) return;

        // Check if hourly rate has changed
        const oldRate = employee.hourly_rate ? parseFloat(employee.hourly_rate) : null;
        const newRate = editForm.hourly_rate ? parseFloat(editForm.hourly_rate as string) : null;
        const rateChanged = oldRate !== newRate && newRate !== null;

        if (rateChanged) {
            // Store the pending rate and show the modal
            setPendingRateChange(editForm.hourly_rate as string);
            setShowRateChangeModal(true);
            return; // Don't save yet, wait for modal response
        }

        // If no rate change, save directly
        await performSave();
    }

    async function performSave(withContract: boolean = false, contractFile: File | null = null) {
        if (!employee) return;
        setSaving(true);
        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/employees/profiles/${employee.id}/`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
                    body: JSON.stringify({
                        first_name: editForm.first_name, last_name: editForm.last_name, prefix_name: editForm.prefix_name,
                        gender: editForm.gender, date_of_birth: editForm.date_of_birth, birthplace: editForm.birthplace,
                        nationality: editForm.nationality, bsn: editForm.bsn, phone_number: editForm.phone_number,
                        street_address: editForm.street_address, street_name: editForm.street_name,
                        house_number: editForm.house_number, house_number_addition: editForm.house_number_addition,
                        postcode: editForm.postcode, city: editForm.city,
                        iban: editForm.iban, hourly_rate: editForm.hourly_rate ? parseFloat(editForm.hourly_rate as string) : null,
                        has_travel_allowance: !!(editForm.travel_cost_per_km || editForm.travel_hour_percentage),
                        travel_cost_per_km: editForm.travel_cost_per_km ? parseFloat(editForm.travel_cost_per_km as string) : null,
                        travel_hour_percentage: editForm.travel_hour_percentage ? parseFloat(editForm.travel_hour_percentage as string) : null,
                        can_add_allowances: editForm.can_add_allowances,
                        receives_surcharges: editForm.receives_surcharges,
                        document_type_id: editForm.document_type_id, document_number: editForm.document_number,
                        document_issue_date: editForm.document_issue_date, document_expiry_date: editForm.document_expiry_date,
                        has_drivers_license: editForm.has_drivers_license, drivers_license_number: editForm.drivers_license_number,
                        drivers_license_issue_date: editForm.drivers_license_issue_date, drivers_license_expiry_date: editForm.drivers_license_expiry_date,
                        drivers_license_categories: selectedCategories,
                        contract_type_id: editForm.contract_type_id, current_agency_id: editForm.current_agency_id,
                        contract_type: editForm.contract_type_id, current_agency: editForm.current_agency_id,
                        contract_phase: editForm.contract_phase, contract_start_date: editForm.contract_start_date, contract_end_date: editForm.contract_end_date,
                        user_email: editForm.user?.email,
                    }),
                }
            );
            if (!response.ok) { const d = await response.json(); throw new Error(d.detail || 'Failed'); }

            // If we need to upload a contract - use the passed file directly
            if (withContract && contractFile && pendingRateChange) {
                const formData = new FormData();
                formData.append('contract_document', contractFile);
                formData.append('hourly_rate', pendingRateChange);
                formData.append('effective_from', new Date().toISOString().split('T')[0]);
                formData.append('notes', 'Contract uploaded with rate change');

                const contractResponse = await fetch(
                    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/employees/profiles/${employee.id}/upload_contract/`,
                    {
                        method: 'POST',
                        headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
                        body: formData,
                    }
                );
                if (!contractResponse.ok) {
                    const d = await contractResponse.json();
                    console.error('Contract upload failed:', d);
                    alert('Rate saved but contract upload failed: ' + (d.error || d.detail || 'Unknown error'));
                }
            }

            setIsEditing(false);
            setShowRateChangeModal(false);
            setPendingRateChange(null);
            setNewContractFile(null);
            await loadEmployee();
            await loadContractHistory();
        } catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
        finally { setSaving(false); }
    }

    function handleRateChangeModalResponse(uploadContract: boolean) {
        if (uploadContract) {
            // Keep modal open to upload file, then save
            // File input will trigger save
        } else {
            // Save without contract
            performSave(false, null);
        }
    }

    async function handleContractFileSelected(file: File) {
        // Pass the file directly to performSave to avoid state timing issues
        await performSave(true, file);
    }

    async function handleApprove() {
        if (!employee) return;
        setSaving(true);
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/employees/profiles/${employee.id}/approve/`,
                { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('access_token')}` } });
            if (!response.ok) { const d = await response.json(); throw new Error(d.error || d.detail || 'Failed'); }
            setShowApproveModal(false);
            await loadEmployee();
        } catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
        finally { setSaving(false); }
    }

    async function handleReject() {
        if (!employee || !rejectReason.trim()) return;
        setSaving(true);
        try {
            const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/employees/profiles/${employee.id}/reject/`,
                { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }, body: JSON.stringify({ reason: rejectReason }) });
            if (!response.ok) { const d = await response.json(); throw new Error(d.detail || 'Failed'); }
            setShowRejectModal(false); setRejectReason('');
            await loadEmployee();
        } catch (err) { alert(err instanceof Error ? err.message : 'Failed'); }
        finally { setSaving(false); }
    }

    function cancelEdit() { setEditForm(employee || {}); setSelectedCategories(employee?.drivers_license_categories || []); setIsEditing(false); }

    async function handleFileUpload(fieldName: string, file: File) {
        if (!employee) return;
        setUploadingFile(fieldName);
        try {
            const formData = new FormData();
            formData.append(fieldName, file);
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/employees/profiles/${employee.id}/`,
                { method: 'PATCH', headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }, body: formData }
            );
            if (!response.ok) throw new Error('Upload failed');

            // Get the updated employee data
            const updatedEmployee = await response.json();

            // Update employee state with new data (for file URLs)
            setEmployee(updatedEmployee);

            // IMPORTANT: Don't reset editForm - preserve user's unsaved changes
            // Only update the file URL field in editForm if it exists
            const urlField = `${fieldName}_url`;
            if (urlField in updatedEmployee) {
                setEditForm(prev => ({ ...prev, [urlField]: updatedEmployee[urlField] }));
            }
        } catch (err) { alert(err instanceof Error ? err.message : 'Upload failed'); }
        finally { setUploadingFile(null); }
    }


    async function handleDeleteFile(fieldName: string) {
        if (!employee || !confirm('Delete this file?')) return;
        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/employees/profiles/${employee.id}/`,
                { method: 'PATCH', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }, body: JSON.stringify({ [fieldName]: null }) }
            );
            if (!response.ok) throw new Error('Failed');
            await loadEmployee();
        } catch (err) { alert('Delete failed'); }
    }

    // Certificate functions
    async function handleAddCertificate(e: React.FormEvent) {
        e.preventDefault();
        if (!employee || !certificateForm.certificate_type_id) return;

        // Validation for files
        if (uploadMode === 'pdf' && !certificateFile) {
            alert('Please upload a certificate PDF file');
            return;
        }
        if (uploadMode === 'images' && (!certificateFile || !certificateFileBack)) {
            alert('Please upload both Front and Back images');
            return;
        }

        setSavingCertificate(true);
        try {
            const formData = new FormData();
            formData.append('employee', employee.id);
            formData.append('certificate_type', certificateForm.certificate_type_id);
            if (certificateFile) formData.append('certificate_file', certificateFile);
            if (uploadMode === 'images' && certificateFileBack) {
                formData.append('certificate_file_back', certificateFileBack);
            }
            if (certificateForm.diploma_number) formData.append('diploma_number', certificateForm.diploma_number);
            if (certificateForm.expiry_date) formData.append('expiry_date', certificateForm.expiry_date);
            if (certificateForm.issue_date) formData.append('issue_date', certificateForm.issue_date);

            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/certificates/employee-certificates/`,
                { method: 'POST', headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` }, body: formData }
            );
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.detail || data.certificate_type?.[0] || 'Failed to add certificate');
            }

            setShowAddCertificateModal(false);
            setCertificateForm({ certificate_type_id: '', diploma_number: '', expiry_date: '', issue_date: '' });
            setCertificateFile(null);
            setCertificateFileBack(null);
            setUploadMode('pdf');
            setCertificatesLoaded(false); // Reload certificates
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to add certificate');
        } finally {
            setSavingCertificate(false);
        }
    }

    async function handleDeleteCertificate(certId: number) {
        if (!confirm('Are you sure you want to delete this certificate?')) return;
        try {
            const response = await fetch(
                `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api'}/certificates/employee-certificates/${certId}/`,
                { method: 'DELETE', headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` } }
            );
            if (!response.ok && response.status !== 204) throw new Error('Failed to delete');
            setCertificatesLoaded(false); // Reload certificates
        } catch (err) {
            alert('Failed to delete certificate');
        }
    }

    function toggleCategory(cat: string) {
        setSelectedCategories(p => p.includes(cat) ? p.filter(c => c !== cat) : [...p, cat]);
    }

    const statusStyles: Record<string, { bg: string; text: string; dot: string }> = {
        approved: { bg: 'bg-emerald-100', text: 'text-emerald-700', dot: 'bg-emerald-500' },
        pending: { bg: 'bg-amber-100', text: 'text-amber-700', dot: 'bg-amber-500' },
        incomplete: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
        rejected: { bg: 'bg-red-100', text: 'text-red-700', dot: 'bg-red-500' },
    };

    const tabs = [
        { id: 'overview' as TabType, label: 'Overview', icon: User },
        { id: 'documents' as TabType, label: 'Documents', icon: FileText },
        { id: 'contract' as TabType, label: 'Contract', icon: Briefcase },
        { id: 'certificates' as TabType, label: 'Certificates', icon: Award },
    ];

    if (noPermission) return <DashboardLayout><div className="flex items-center justify-center h-[80vh]"><div className="text-center"><Lock className="w-16 h-16 text-red-500 mx-auto mb-4" /><p className="text-gray-600 mb-4">Access Denied</p><Button onClick={() => router.push('/dashboard')} className="bg-[#1E3A5F]">Back</Button></div></div></DashboardLayout>;
    if (loading) return <DashboardLayout><div className="flex items-center justify-center h-[80vh]"><div className="w-10 h-10 border-4 border-[#1E3A5F] border-t-transparent rounded-full animate-spin"></div></div></DashboardLayout>;
    if (error || !employee) return <DashboardLayout><div className="flex items-center justify-center h-[80vh]"><div className="text-center"><AlertTriangle className="w-16 h-16 text-red-500 mx-auto mb-4" /><p className="text-gray-500 mb-4">{error || 'Not found'}</p><Button onClick={() => router.push('/dashboard/employees')} className="bg-[#1E3A5F]">Back</Button></div></div></DashboardLayout>;

    const status = statusStyles[employee.status] || statusStyles.incomplete;

    return (
        <DashboardLayout>
            <div className="min-h-screen bg-gray-50">
                {/* Top Bar */}
                <div className="bg-white border-b sticky top-0 z-20">
                    <div className="max-w-5xl mx-auto px-6 py-3 flex items-center justify-between">
                        <button onClick={() => router.push('/dashboard/employees')} className="flex items-center gap-2 text-gray-500 hover:text-gray-900 text-sm font-medium">
                            <ArrowLeft className="w-4 h-4" /> Back to Employees
                        </button>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {isEditing ? (
                                <>
                                    <button
                                        onClick={cancelEdit}
                                        disabled={saving}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '10px 18px',
                                            backgroundColor: 'white',
                                            border: '2px solid #E5E7EB',
                                            borderRadius: '10px',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            color: '#374151',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <X style={{ width: '16px', height: '16px' }} /> Cancel
                                    </button>
                                    <button
                                        onClick={handleSaveEdit}
                                        disabled={saving}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '10px 18px',
                                            backgroundColor: '#1E3A5F',
                                            border: 'none',
                                            borderRadius: '10px',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            color: 'white',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <Save style={{ width: '16px', height: '16px' }} /> {saving ? 'Saving...' : 'Save'}
                                    </button>
                                </>
                            ) : (
                                <>
                                    <button
                                        onClick={() => setIsEditing(true)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '6px',
                                            padding: '10px 18px',
                                            backgroundColor: 'white',
                                            border: '2px solid #E5E7EB',
                                            borderRadius: '10px',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            color: '#374151',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <Edit style={{ width: '16px', height: '16px' }} /> Edit
                                    </button>
                                    {employee.status === 'pending' && (
                                        <>
                                            <button
                                                onClick={() => setShowApproveModal(true)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '10px 18px',
                                                    backgroundColor: '#16A34A',
                                                    border: 'none',
                                                    borderRadius: '10px',
                                                    fontSize: '14px',
                                                    fontWeight: 600,
                                                    color: 'white',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    boxShadow: '0 4px 12px rgba(22, 163, 74, 0.3)',
                                                }}
                                            >
                                                <Check style={{ width: '16px', height: '16px' }} /> Approve
                                            </button>
                                            <button
                                                onClick={() => setShowRejectModal(true)}
                                                style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    gap: '6px',
                                                    padding: '10px 18px',
                                                    backgroundColor: '#DC2626',
                                                    border: 'none',
                                                    borderRadius: '10px',
                                                    fontSize: '14px',
                                                    fontWeight: 600,
                                                    color: 'white',
                                                    cursor: 'pointer',
                                                    transition: 'all 0.2s',
                                                    boxShadow: '0 4px 12px rgba(220, 38, 38, 0.3)',
                                                }}
                                            >
                                                <X style={{ width: '16px', height: '16px' }} /> Reject
                                            </button>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Profile Header */}
                <div style={{ background: 'linear-gradient(135deg, #1E3A5F 0%, #2E5A8F 100%)' }}>
                    <div style={{
                        maxWidth: '1024px',
                        margin: '0 auto',
                        padding: '32px 24px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '24px',
                    }}>
                        {/* Avatar */}
                        <div style={{
                            width: '80px',
                            height: '80px',
                            backgroundColor: 'white',
                            borderRadius: '16px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '24px',
                            fontWeight: 700,
                            color: '#1E3A5F',
                            boxShadow: '0 8px 24px rgba(0,0,0,0.15)',
                            flexShrink: 0,
                        }}>
                            {employee.first_name?.[0]}{employee.last_name?.[0]}
                        </div>

                        {/* Name */}
                        <div style={{ flex: 1, minWidth: 0 }}>
                            <h1 style={{
                                fontSize: '28px',
                                fontWeight: 700,
                                color: 'white',
                                margin: 0,
                                letterSpacing: '-0.02em',
                            }}>
                                {employee.full_name || `${employee.first_name} ${employee.prefix_name || ''} ${employee.last_name}`.trim()}
                            </h1>
                            <p style={{
                                color: 'rgba(255,255,255,0.6)',
                                fontSize: '14px',
                                margin: '4px 0 0',
                            }}>
                                Employee Profile
                            </p>
                        </div>

                        {/* Status Badge - Clickable dropdown for admin */}
                        <div style={{ position: 'relative' }}>
                            <select
                                value={employee.status}
                                onChange={async (e) => {
                                    const newStatus = e.target.value;
                                    try {
                                        const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
                                        const response = await fetch(`${API_URL}/employees/profiles/${params.id}/`, {
                                            method: 'PATCH',
                                            headers: {
                                                'Content-Type': 'application/json',
                                                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                                            },
                                            body: JSON.stringify({ status: newStatus }),
                                        });
                                        if (!response.ok) throw new Error('Failed to update status');
                                        // Refresh the page data
                                        setEmployee({ ...employee, status: newStatus });
                                    } catch (err) {
                                        alert('Failed to update status');
                                    }
                                }}
                                style={{
                                    appearance: 'none',
                                    padding: '12px 40px 12px 50px',
                                    borderRadius: '12px',
                                    fontSize: '14px',
                                    fontWeight: 600,
                                    cursor: 'pointer',
                                    backgroundColor: employee.status === 'approved' ? 'rgba(16, 185, 129, 0.15)' :
                                        employee.status === 'pending' ? 'rgba(251, 191, 36, 0.15)' :
                                            employee.status === 'rejected' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255,255,255,0.1)',
                                    border: `1px solid ${employee.status === 'approved' ? 'rgba(16, 185, 129, 0.3)' :
                                        employee.status === 'pending' ? 'rgba(251, 191, 36, 0.3)' :
                                            employee.status === 'rejected' ? 'rgba(239, 68, 68, 0.3)' : 'rgba(255,255,255,0.2)'}`,
                                    color: employee.status === 'approved' ? '#34D399' :
                                        employee.status === 'pending' ? '#FCD34D' :
                                            employee.status === 'rejected' ? '#F87171' : 'white',
                                    textTransform: 'capitalize',
                                    outline: 'none',
                                }}
                            >
                                <option value="incomplete" style={{ color: '#374151', backgroundColor: 'white' }}>Incomplete</option>
                                <option value="pending" style={{ color: '#374151', backgroundColor: 'white' }}>Pending</option>
                                <option value="approved" style={{ color: '#374151', backgroundColor: 'white' }}>Approved</option>
                                <option value="rejected" style={{ color: '#374151', backgroundColor: 'white' }}>Rejected</option>
                                <option value="suspended" style={{ color: '#374151', backgroundColor: 'white' }}>Suspended</option>
                            </select>
                            {/* Status Icon */}
                            <div style={{
                                position: 'absolute',
                                left: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                width: '28px',
                                height: '28px',
                                borderRadius: '6px',
                                backgroundColor: employee.status === 'approved' ? '#10B981' :
                                    employee.status === 'pending' ? '#FBBF24' :
                                        employee.status === 'rejected' ? '#EF4444' : '#6B7280',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                pointerEvents: 'none',
                            }}>
                                {employee.status === 'approved' && <CheckCircle size={16} color="white" />}
                                {employee.status === 'pending' && <Clock size={16} color="white" />}
                                {employee.status === 'rejected' && <X size={16} color="white" />}
                                {(employee.status !== 'approved' && employee.status !== 'pending' && employee.status !== 'rejected') && <AlertTriangle size={16} color="white" />}
                            </div>
                            {/* Dropdown Arrow */}
                            <div style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                pointerEvents: 'none',
                            }}>
                                <ChevronDown size={16} color="rgba(255,255,255,0.6)" />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{
                    backgroundColor: 'white',
                    borderBottom: '1px solid #E5E7EB',
                    position: 'sticky',
                    top: '60px',
                    zIndex: 10,
                }}>
                    <div style={{ maxWidth: '1024px', margin: '0 auto', padding: '16px 24px' }}>
                        <nav style={{
                            display: 'inline-flex',
                            gap: '8px',
                            backgroundColor: '#F3F4F6',
                            padding: '6px',
                            borderRadius: '12px',
                        }}>
                            {tabs.map(tab => {
                                const Icon = tab.icon;
                                const active = activeTab === tab.id;
                                return (
                                    <button
                                        key={tab.id}
                                        onClick={() => setActiveTab(tab.id)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '10px 20px',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            border: 'none',
                                            cursor: 'pointer',
                                            transition: 'all 0.2s ease',
                                            backgroundColor: active ? 'white' : 'transparent',
                                            color: active ? '#1E3A5F' : '#6B7280',
                                            boxShadow: active ? '0 2px 8px rgba(0,0,0,0.08)' : 'none',
                                        }}
                                    >
                                        <Icon size={16} />
                                        {tab.label}
                                    </button>
                                );
                            })}
                        </nav>
                    </div>
                </div>

                {/* Content */}
                <div className="max-w-5xl mx-auto px-6 py-6">
                    {employee.status === 'rejected' && employee.rejection_reason && (
                        <div style={{
                            backgroundColor: 'white',
                            borderRadius: '16px',
                            border: '1px solid #FCA5A5',
                            marginBottom: '24px',
                            overflow: 'hidden',
                        }}>
                            <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                gap: '12px',
                                padding: '16px 20px',
                                backgroundColor: '#FEF2F2',
                                borderBottom: '1px solid #FCA5A5',
                            }}>
                                <div style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '10px',
                                    backgroundColor: '#FEE2E2',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                }}>
                                    <AlertTriangle style={{ width: '20px', height: '20px', color: '#DC2626' }} />
                                </div>
                                <div>
                                    <h4 style={{ fontSize: '16px', fontWeight: 600, color: '#991B1B', margin: 0 }}>Application Rejected</h4>
                                    <p style={{ fontSize: '13px', color: '#B91C1C', margin: 0, marginTop: '2px' }}>This employee&apos;s application was rejected</p>
                                </div>
                            </div>
                            <div style={{ padding: '16px 20px' }}>
                                <label style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Rejection Reason</label>
                                <p style={{ fontSize: '14px', color: '#374151', marginTop: '8px', lineHeight: '1.6' }}>{employee.rejection_reason}</p>
                            </div>
                        </div>
                    )}

                    {/* OVERVIEW */}
                    {activeTab === 'overview' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            <Card title="Personal Information" icon={User} iconColor="text-blue-600" iconBg="bg-blue-50">
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="First Name" value={editForm.first_name} editing={isEditing} onChange={v => setEditForm({ ...editForm, first_name: v })} />
                                    <Field label="Prefix" value={editForm.prefix_name} editing={isEditing} onChange={v => setEditForm({ ...editForm, prefix_name: v })} />
                                    <Field label="Last Name" value={editForm.last_name} editing={isEditing} onChange={v => setEditForm({ ...editForm, last_name: v })} />
                                    <Field label="Gender" value={editForm.gender} editing={isEditing} type="select" options={['male', 'female', 'other']} onChange={v => setEditForm({ ...editForm, gender: v })} />
                                    <Field label="Date of Birth" value={editForm.date_of_birth} editing={isEditing} type="date" onChange={v => setEditForm({ ...editForm, date_of_birth: v })} />
                                    <Field label="Birthplace" value={editForm.birthplace} editing={isEditing} onChange={v => setEditForm({ ...editForm, birthplace: v })} />

                                    {/* Custom Searchable Nationality Dropdown */}
                                    {isEditing ? (
                                        <div ref={nationalityDropdownRef} style={{ position: 'relative' }}>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6B7280', marginBottom: '8px', textTransform: 'uppercase' }}>Nationality</label>
                                            <div
                                                onClick={() => setNationalityDropdownOpen(!nationalityDropdownOpen)}
                                                style={{
                                                    width: '100%',
                                                    padding: '12px 16px',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    backgroundColor: '#F9FAFB',
                                                    border: '1px solid #E5E7EB',
                                                    borderRadius: '10px',
                                                    cursor: 'pointer',
                                                    fontSize: '14px',
                                                }}
                                            >
                                                <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                    {editForm.nationality ? (
                                                        <>
                                                            <span style={{ fontSize: '18px' }}>
                                                                {NATIONALITIES.find(n => n.name === editForm.nationality)?.flag || '🌍'}
                                                            </span>
                                                            {editForm.nationality}
                                                        </>
                                                    ) : (
                                                        <span style={{ color: '#9CA3AF' }}>Select nationality...</span>
                                                    )}
                                                </span>
                                                <ChevronDown size={16} color="#6B7280" style={{ transform: nationalityDropdownOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s' }} />
                                            </div>

                                            {nationalityDropdownOpen && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '100%',
                                                    left: 0,
                                                    right: 0,
                                                    marginTop: '4px',
                                                    backgroundColor: '#FFFFFF',
                                                    border: '1px solid #E5E7EB',
                                                    borderRadius: '10px',
                                                    boxShadow: '0 4px 20px rgba(0,0,0,0.15)',
                                                    zIndex: 9999,
                                                }}>
                                                    {/* Search Input */}
                                                    <div style={{ padding: '10px', borderBottom: '1px solid #E5E7EB' }}>
                                                        <div style={{ position: 'relative' }}>
                                                            <Search size={14} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9CA3AF' }} />
                                                            <input
                                                                type="text"
                                                                value={nationalitySearch}
                                                                onChange={(e) => setNationalitySearch(e.target.value)}
                                                                placeholder="Search nationality..."
                                                                autoFocus
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '10px 12px 10px 36px',
                                                                    border: '1px solid #E5E7EB',
                                                                    borderRadius: '8px',
                                                                    fontSize: '14px',
                                                                    outline: 'none',
                                                                }}
                                                                onClick={(e) => e.stopPropagation()}
                                                            />
                                                        </div>
                                                    </div>

                                                    {/* Options List */}
                                                    <div style={{ maxHeight: '220px', overflowY: 'auto' }}>
                                                        {NATIONALITIES
                                                            .filter(n => n.name.toLowerCase().includes(nationalitySearch.toLowerCase()))
                                                            .map((nationality) => (
                                                                <div
                                                                    key={nationality.name}
                                                                    onClick={() => {
                                                                        setEditForm({ ...editForm, nationality: nationality.name });
                                                                        setNationalityDropdownOpen(false);
                                                                        setNationalitySearch('');
                                                                    }}
                                                                    style={{
                                                                        padding: '12px 14px',
                                                                        display: 'flex',
                                                                        alignItems: 'center',
                                                                        gap: '12px',
                                                                        cursor: 'pointer',
                                                                        backgroundColor: editForm.nationality === nationality.name ? '#EFF6FF' : 'transparent',
                                                                        borderLeft: editForm.nationality === nationality.name ? '3px solid #2563EB' : '3px solid transparent',
                                                                    }}
                                                                    onMouseEnter={(e) => {
                                                                        if (editForm.nationality !== nationality.name) {
                                                                            e.currentTarget.style.backgroundColor = '#F9FAFB';
                                                                        }
                                                                    }}
                                                                    onMouseLeave={(e) => {
                                                                        if (editForm.nationality !== nationality.name) {
                                                                            e.currentTarget.style.backgroundColor = 'transparent';
                                                                        }
                                                                    }}
                                                                >
                                                                    <span style={{ fontSize: '20px' }}>{nationality.flag}</span>
                                                                    <span style={{ fontSize: '14px', color: '#374151', fontWeight: editForm.nationality === nationality.name ? 600 : 400 }}>{nationality.name}</span>
                                                                    {editForm.nationality === nationality.name && (
                                                                        <CheckCircle size={16} color="#2563EB" style={{ marginLeft: 'auto' }} />
                                                                    )}
                                                                </div>
                                                            ))
                                                        }
                                                        {NATIONALITIES.filter(n => n.name.toLowerCase().includes(nationalitySearch.toLowerCase())).length === 0 && (
                                                            <div style={{ padding: '16px', textAlign: 'center', color: '#9CA3AF', fontSize: '14px' }}>
                                                                No nationality found
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ padding: '4px 0' }}>
                                            <p style={{ fontSize: '12px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: '4px', margin: 0 }}>Nationality</p>
                                            <p style={{ fontSize: '14px', fontWeight: 500, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                {editForm.nationality ? (
                                                    <>
                                                        <span style={{ fontSize: '16px' }}>{NATIONALITIES.find(n => n.name === editForm.nationality)?.flag || '🌍'}</span>
                                                        {editForm.nationality}
                                                    </>
                                                ) : <span style={{ color: '#9CA3AF' }}>—</span>}
                                            </p>
                                        </div>
                                    )}
                                    <Field
                                        label="BSN"
                                        value={editForm.bsn ? editForm.bsn.replace(/\D/g, '').replace(/(\d{4})(\d{2})(\d{3})/, '$1.$2.$3') : ''}
                                        editing={isEditing}
                                        onChange={v => {
                                            // Remove all non-digits, limit to 9 digits
                                            const digitsOnly = v.replace(/\D/g, '').slice(0, 9);
                                            setEditForm({ ...editForm, bsn: digitsOnly });
                                        }}
                                    />
                                </div>
                            </Card>

                            <Card title="Contact Information" icon={Phone} iconColor="text-green-600" iconBg="bg-green-50">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="col-span-2">
                                        <Field label="Email" value={editForm.user?.email || employee.user?.email} editing={isEditing} onChange={v => setEditForm({ ...editForm, user: { ...editForm.user, email: v } as any })} />
                                    </div>
                                    <Field label="Phone" value={editForm.phone_number} editing={isEditing} onChange={v => setEditForm({ ...editForm, phone_number: v })} />
                                    <Field label="City" value={editForm.city} editing={isEditing} onChange={v => setEditForm({ ...editForm, city: v })} />

                                    {/* Street Name with Icon */}
                                    {isEditing ? (
                                        <div>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6B7280', marginBottom: '8px', textTransform: 'uppercase' }}>
                                                Street Name
                                            </label>
                                            <div style={{ position: 'relative' }}>
                                                <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px' }}>🛣️</span>
                                                <input
                                                    type="text"
                                                    value={editForm.street_name || ''}
                                                    onChange={(e) => setEditForm({ ...editForm, street_name: e.target.value })}
                                                    placeholder="Kerkstraat"
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px 16px 12px 40px',
                                                        backgroundColor: '#F9FAFB',
                                                        border: '1px solid #E5E7EB',
                                                        borderRadius: '10px',
                                                        fontSize: '14px',
                                                        outline: 'none',
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ padding: '4px 0' }}>
                                            <p style={{ fontSize: '12px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: '4px', margin: 0 }}>Street Name</p>
                                            <p style={{ fontSize: '14px', fontWeight: 500, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                <span style={{ fontSize: '12px' }}>🛣️</span>
                                                {editForm.street_name || '—'}
                                            </p>
                                        </div>
                                    )}

                                    {/* House Number and Addition Row */}
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        {/* House Number */}
                                        {isEditing ? (
                                            <div style={{ flex: 1 }}>
                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6B7280', marginBottom: '8px', textTransform: 'uppercase' }}>
                                                    House Nr.
                                                </label>
                                                <div style={{ position: 'relative' }}>
                                                    <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', fontSize: '14px' }}>🏠</span>
                                                    <input
                                                        type="text"
                                                        value={editForm.house_number || ''}
                                                        onChange={(e) => setEditForm({ ...editForm, house_number: e.target.value })}
                                                        placeholder="123"
                                                        style={{
                                                            width: '100%',
                                                            padding: '12px 16px 12px 40px',
                                                            backgroundColor: '#F9FAFB',
                                                            border: '1px solid #E5E7EB',
                                                            borderRadius: '10px',
                                                            fontSize: '14px',
                                                            outline: 'none',
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ padding: '4px 0', flex: 1 }}>
                                                <p style={{ fontSize: '12px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: '4px', margin: 0 }}>House Nr.</p>
                                                <p style={{ fontSize: '14px', fontWeight: 500, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    <span style={{ fontSize: '12px' }}>🏠</span>
                                                    {editForm.house_number || '—'}
                                                </p>
                                            </div>
                                        )}

                                        {/* House Number Addition */}
                                        {isEditing ? (
                                            <div style={{ width: '80px' }}>
                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6B7280', marginBottom: '8px', textTransform: 'uppercase' }}>
                                                    Add.
                                                </label>
                                                <div style={{ position: 'relative' }}>
                                                    <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', fontSize: '12px' }}>➕</span>
                                                    <input
                                                        type="text"
                                                        value={editForm.house_number_addition || ''}
                                                        onChange={(e) => setEditForm({ ...editForm, house_number_addition: e.target.value.toUpperCase() })}
                                                        placeholder="A"
                                                        style={{
                                                            width: '100%',
                                                            padding: '12px 10px 12px 32px',
                                                            backgroundColor: '#F9FAFB',
                                                            border: '1px solid #E5E7EB',
                                                            borderRadius: '10px',
                                                            fontSize: '14px',
                                                            outline: 'none',
                                                            textTransform: 'uppercase',
                                                        }}
                                                    />
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ padding: '4px 0', width: '80px' }}>
                                                <p style={{ fontSize: '12px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: '4px', margin: 0 }}>Add.</p>
                                                <p style={{ fontSize: '14px', fontWeight: 500, color: '#111827', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                    {editForm.house_number_addition && <span style={{ fontSize: '12px' }}>➕</span>}
                                                    {editForm.house_number_addition || ''}
                                                </p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Custom Postcode Input with Lookup */}
                                    {isEditing ? (
                                        <div ref={postcodeDropdownRef} style={{ position: 'relative' }}>
                                            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#6B7280', marginBottom: '8px', textTransform: 'uppercase' }}>Postcode</label>
                                            <div style={{ position: 'relative' }}>
                                                <input
                                                    type="text"
                                                    value={editForm.postcode || ''}
                                                    onChange={(e) => {
                                                        const value = e.target.value.toUpperCase();
                                                        setEditForm({ ...editForm, postcode: value });
                                                        lookupPostcode(value);
                                                    }}
                                                    placeholder="1234AB"
                                                    style={{
                                                        width: '100%',
                                                        padding: '12px 16px',
                                                        paddingRight: postcodeLookupLoading ? '40px' : '16px',
                                                        backgroundColor: '#F9FAFB',
                                                        border: '1px solid #E5E7EB',
                                                        borderRadius: '10px',
                                                        fontSize: '14px',
                                                        outline: 'none',
                                                        fontFamily: 'monospace',
                                                    }}
                                                />
                                                {postcodeLookupLoading && (
                                                    <div style={{
                                                        position: 'absolute',
                                                        right: '12px',
                                                        top: '50%',
                                                        transform: 'translateY(-50%)',
                                                        width: '16px',
                                                        height: '16px',
                                                        border: '2px solid #E5E7EB',
                                                        borderTopColor: '#2563EB',
                                                        borderRadius: '50%',
                                                        animation: 'spin 1s linear infinite',
                                                    }} />
                                                )}
                                            </div>

                                            {showPostcodeSuggestions && postcodeSuggestions.length > 0 && (
                                                <div style={{
                                                    position: 'absolute',
                                                    top: '100%',
                                                    left: 0,
                                                    right: 0,
                                                    marginTop: '4px',
                                                    backgroundColor: '#FFFFFF',
                                                    border: '1px solid #E5E7EB',
                                                    borderRadius: '10px',
                                                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                                                    zIndex: 9999,
                                                    overflow: 'hidden',
                                                }}>
                                                    <div style={{ padding: '8px 12px', borderBottom: '1px solid #E5E7EB', backgroundColor: '#F9FAFB' }}>
                                                        <span style={{ fontSize: '11px', color: '#6B7280', fontWeight: 600, textTransform: 'uppercase' }}>🛣️ Select Address</span>
                                                    </div>
                                                    <div style={{ maxHeight: '240px', overflowY: 'auto' }}>
                                                        {postcodeSuggestions.map((suggestion, index) => (
                                                            <div
                                                                key={index}
                                                                onClick={() => {
                                                                    setEditForm({
                                                                        ...editForm,
                                                                        city: suggestion.city,
                                                                        street_name: suggestion.street || editForm.street_name,
                                                                        // house_number is NOT auto-filled - user must enter it
                                                                    });
                                                                    setShowPostcodeSuggestions(false);
                                                                }}
                                                                style={{
                                                                    padding: '12px 14px',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    gap: '12px',
                                                                    cursor: 'pointer',
                                                                    backgroundColor: 'transparent',
                                                                    borderBottom: '1px solid #F3F4F6',
                                                                }}
                                                                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#EFF6FF'}
                                                                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                                            >
                                                                <div style={{
                                                                    width: '36px',
                                                                    height: '36px',
                                                                    borderRadius: '8px',
                                                                    backgroundColor: suggestion.street ? '#DBEAFE' : '#F3F4F6',
                                                                    display: 'flex',
                                                                    alignItems: 'center',
                                                                    justifyContent: 'center',
                                                                    fontSize: '16px'
                                                                }}>
                                                                    {suggestion.street ? '🛣️' : '🏙️'}
                                                                </div>
                                                                <div style={{ flex: 1 }}>
                                                                    {suggestion.street ? (
                                                                        <>
                                                                            <div style={{ fontSize: '14px', color: '#111827', fontWeight: 600 }}>{suggestion.street}</div>
                                                                            <div style={{ fontSize: '12px', color: '#6B7280' }}>{suggestion.city}</div>
                                                                        </>
                                                                    ) : (
                                                                        <div style={{ fontSize: '14px', color: '#111827', fontWeight: 500 }}>{suggestion.city}</div>
                                                                    )}
                                                                </div>
                                                                <div style={{
                                                                    padding: '4px 8px',
                                                                    backgroundColor: '#ECFDF5',
                                                                    borderRadius: '4px',
                                                                    fontSize: '11px',
                                                                    color: '#059669',
                                                                    fontWeight: 600
                                                                }}>
                                                                    Select
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    ) : (
                                        <div style={{ padding: '4px 0' }}>
                                            <p style={{ fontSize: '12px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: '4px', margin: 0 }}>Postcode</p>
                                            <p style={{ fontSize: '14px', fontWeight: 500, color: '#111827', margin: 0, fontFamily: 'monospace' }}>{editForm.postcode || '—'}</p>
                                        </div>
                                    )}
                                </div>
                            </Card>

                            <Card title="Financial Information" icon={CreditCard} iconColor="text-amber-600" iconBg="bg-amber-50">
                                <div className="grid grid-cols-2 gap-4">
                                    <Field label="IBAN" value={editForm.iban} editing={isEditing} onChange={v => setEditForm({ ...editForm, iban: v.toUpperCase().replace(/\s/g, '') })} />
                                    <Field label="Hourly Rate (€)" value={editForm.hourly_rate} editing={isEditing} type="number" onChange={v => setEditForm({ ...editForm, hourly_rate: v })} />
                                </div>

                                {/* Travel Allowance Section */}
                                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #E5E7EB' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                        <Car size={18} color="#6B7280" />
                                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                            Travel Allowance
                                        </span>
                                    </div>

                                    <div style={{ display: 'grid', gap: '12px' }}>
                                        {/* Travel Cost per KM Row */}
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '16px',
                                                padding: '16px 20px',
                                                backgroundColor: editForm.travel_cost_per_km ? 'rgba(124, 58, 237, 0.03)' : '#F9FAFB',
                                                border: `2px solid ${editForm.travel_cost_per_km ? '#7C3AED' : '#E5E7EB'}`,
                                                borderRadius: '12px',
                                                transition: 'all 0.15s ease',
                                            }}
                                        >
                                            {/* Checkbox */}
                                            {isEditing && (
                                                <button
                                                    type="button"
                                                    onClick={() => setEditForm({
                                                        ...editForm,
                                                        travel_cost_per_km: editForm.travel_cost_per_km ? null : ''
                                                    })}
                                                    style={{
                                                        width: '24px',
                                                        height: '24px',
                                                        borderRadius: '6px',
                                                        backgroundColor: editForm.travel_cost_per_km ? '#7C3AED' : 'white',
                                                        border: editForm.travel_cost_per_km ? 'none' : '2px solid #D1D5DB',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    {editForm.travel_cost_per_km !== null && editForm.travel_cost_per_km !== undefined && (
                                                        <Check size={16} color="white" />
                                                    )}
                                                </button>
                                            )}

                                            {/* Icon */}
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '10px',
                                                backgroundColor: editForm.travel_cost_per_km ? 'rgba(124, 58, 237, 0.1)' : '#E5E7EB',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                            }}>
                                                <Car size={20} color={editForm.travel_cost_per_km ? '#7C3AED' : '#9CA3AF'} />
                                            </div>

                                            {/* Info */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{
                                                    fontSize: '14px',
                                                    fontWeight: 600,
                                                    color: editForm.travel_cost_per_km ? '#1F2937' : '#6B7280',
                                                    margin: 0,
                                                }}>
                                                    Travel Cost per KM
                                                </p>
                                                <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '2px 0 0' }}>
                                                    Cost per kilometer for travel reimbursement
                                                </p>
                                            </div>

                                            {/* Input or Badge */}
                                            {(editForm.travel_cost_per_km !== null && editForm.travel_cost_per_km !== undefined) && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                                    {isEditing ? (
                                                        <>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                step="0.01"
                                                                value={editForm.travel_cost_per_km || ''}
                                                                onChange={(e) => setEditForm({ ...editForm, travel_cost_per_km: e.target.value })}
                                                                style={{
                                                                    width: '70px',
                                                                    padding: '6px 10px',
                                                                    fontSize: '14px',
                                                                    fontWeight: 600,
                                                                    border: '1px solid #E5E7EB',
                                                                    borderRadius: '8px',
                                                                    textAlign: 'right',
                                                                }}
                                                            />
                                                            <span style={{ color: '#6B7280', fontWeight: 500, fontSize: '13px' }}>€/km</span>
                                                        </>
                                                    ) : (
                                                        <div style={{
                                                            padding: '6px 12px',
                                                            backgroundColor: '#D1FAE5',
                                                            borderRadius: '8px',
                                                        }}>
                                                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#059669' }}>
                                                                €{parseFloat(editForm.travel_cost_per_km || '0').toFixed(2)}/km
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>

                                        {/* Travel Hour Percentage Row */}
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '16px',
                                                padding: '16px 20px',
                                                backgroundColor: editForm.travel_hour_percentage ? 'rgba(59, 130, 246, 0.03)' : '#F9FAFB',
                                                border: `2px solid ${editForm.travel_hour_percentage ? '#3B82F6' : '#E5E7EB'}`,
                                                borderRadius: '12px',
                                                transition: 'all 0.15s ease',
                                            }}
                                        >
                                            {/* Checkbox */}
                                            {isEditing && (
                                                <button
                                                    type="button"
                                                    onClick={() => setEditForm({
                                                        ...editForm,
                                                        travel_hour_percentage: editForm.travel_hour_percentage ? null : ''
                                                    })}
                                                    style={{
                                                        width: '24px',
                                                        height: '24px',
                                                        borderRadius: '6px',
                                                        backgroundColor: editForm.travel_hour_percentage ? '#3B82F6' : 'white',
                                                        border: editForm.travel_hour_percentage ? 'none' : '2px solid #D1D5DB',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                        cursor: 'pointer',
                                                        flexShrink: 0,
                                                    }}
                                                >
                                                    {editForm.travel_hour_percentage !== null && editForm.travel_hour_percentage !== undefined && (
                                                        <Check size={16} color="white" />
                                                    )}
                                                </button>
                                            )}

                                            {/* Icon */}
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '10px',
                                                backgroundColor: editForm.travel_hour_percentage ? 'rgba(59, 130, 246, 0.1)' : '#E5E7EB',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                flexShrink: 0,
                                            }}>
                                                <Clock size={20} color={editForm.travel_hour_percentage ? '#3B82F6' : '#9CA3AF'} />
                                            </div>

                                            {/* Info */}
                                            <div style={{ flex: 1, minWidth: 0 }}>
                                                <p style={{
                                                    fontSize: '14px',
                                                    fontWeight: 600,
                                                    color: editForm.travel_hour_percentage ? '#1F2937' : '#6B7280',
                                                    margin: 0,
                                                }}>
                                                    Travel Hour Percentage
                                                </p>
                                                <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '2px 0 0' }}>
                                                    Percentage of travel time to compensate
                                                </p>
                                            </div>

                                            {/* Input or Badge */}
                                            {(editForm.travel_hour_percentage !== null && editForm.travel_hour_percentage !== undefined) && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                                                    {isEditing ? (
                                                        <>
                                                            <input
                                                                type="number"
                                                                min="0"
                                                                max="100"
                                                                step="0.01"
                                                                value={editForm.travel_hour_percentage || ''}
                                                                onChange={(e) => setEditForm({ ...editForm, travel_hour_percentage: e.target.value })}
                                                                style={{
                                                                    width: '70px',
                                                                    padding: '6px 10px',
                                                                    fontSize: '14px',
                                                                    fontWeight: 600,
                                                                    border: '1px solid #E5E7EB',
                                                                    borderRadius: '8px',
                                                                    textAlign: 'right',
                                                                }}
                                                            />
                                                            <span style={{ color: '#6B7280', fontWeight: 500, fontSize: '13px' }}>%</span>
                                                        </>
                                                    ) : (
                                                        <div style={{
                                                            padding: '6px 12px',
                                                            backgroundColor: '#D1FAE5',
                                                            borderRadius: '8px',
                                                        }}>
                                                            <span style={{ fontSize: '14px', fontWeight: 700, color: '#059669' }}>
                                                                {parseFloat(editForm.travel_hour_percentage || '0').toFixed(2)}%
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Permission Flags Section */}
                                <div style={{ marginTop: '24px', paddingTop: '16px', borderTop: '1px solid #E5E7EB' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                                        <Check size={18} color="#6B7280" />
                                        <span style={{ fontSize: '14px', fontWeight: 600, color: '#374151' }}>
                                            Permission Flags
                                        </span>
                                    </div>

                                    <div style={{ display: 'grid', gap: '12px' }}>
                                        {/* Can Add Allowances */}
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '16px',
                                                padding: '16px 20px',
                                                backgroundColor: editForm.can_add_allowances ? 'rgba(139, 92, 246, 0.03)' : '#F9FAFB',
                                                border: `2px solid ${editForm.can_add_allowances ? '#8B5CF6' : '#E5E7EB'}`,
                                                borderRadius: '12px',
                                            }}
                                        >
                                            {isEditing && (
                                                <button
                                                    type="button"
                                                    onClick={() => setEditForm({ ...editForm, can_add_allowances: !editForm.can_add_allowances })}
                                                    style={{
                                                        width: '24px', height: '24px', borderRadius: '6px',
                                                        backgroundColor: editForm.can_add_allowances ? '#8B5CF6' : 'white',
                                                        border: editForm.can_add_allowances ? 'none' : '2px solid #D1D5DB',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                                    }}
                                                >
                                                    {editForm.can_add_allowances && <Check size={16} color="white" />}
                                                </button>
                                            )}
                                            <div style={{ flex: 1 }}>
                                                <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>Can Add Allowances</span>
                                                <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>Allow employee to add Toeslag to work logs</p>
                                            </div>
                                            {!isEditing && (
                                                <span style={{
                                                    padding: '4px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                                                    backgroundColor: editForm.can_add_allowances ? '#D1FAE5' : '#FEE2E2',
                                                    color: editForm.can_add_allowances ? '#059669' : '#DC2626'
                                                }}>
                                                    {editForm.can_add_allowances ? 'Enabled' : 'Disabled'}
                                                </span>
                                            )}
                                        </div>

                                        {/* Receives Surcharges */}
                                        <div
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '16px',
                                                padding: '16px 20px',
                                                backgroundColor: editForm.receives_surcharges ? 'rgba(245, 158, 11, 0.03)' : '#F9FAFB',
                                                border: `2px solid ${editForm.receives_surcharges ? '#F59E0B' : '#E5E7EB'}`,
                                                borderRadius: '12px',
                                            }}
                                        >
                                            {isEditing && (
                                                <button
                                                    type="button"
                                                    onClick={() => setEditForm({ ...editForm, receives_surcharges: !editForm.receives_surcharges })}
                                                    style={{
                                                        width: '24px', height: '24px', borderRadius: '6px',
                                                        backgroundColor: editForm.receives_surcharges ? '#F59E0B' : 'white',
                                                        border: editForm.receives_surcharges ? 'none' : '2px solid #D1D5DB',
                                                        display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer',
                                                    }}
                                                >
                                                    {editForm.receives_surcharges && <Check size={16} color="white" />}
                                                </button>
                                            )}
                                            <div style={{ flex: 1 }}>
                                                <span style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>Receives Surcharges</span>
                                                <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>Receives night/weekend/holiday surcharge payments</p>
                                            </div>
                                            {!isEditing && (
                                                <span style={{
                                                    padding: '4px 12px', borderRadius: '6px', fontSize: '13px', fontWeight: 600,
                                                    backgroundColor: editForm.receives_surcharges ? '#D1FAE5' : '#FEE2E2',
                                                    color: editForm.receives_surcharges ? '#059669' : '#DC2626'
                                                }}>
                                                    {editForm.receives_surcharges ? 'Enabled' : 'Disabled'}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </Card>

                            {/* Rate History Card */}
                            <Card title="Rate History" icon={Clock} iconColor="text-blue-600" iconBg="bg-blue-50">
                                <div style={{ overflowX: 'auto' }}>
                                    <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                        <thead>
                                            <tr style={{ borderBottom: '1px solid #E5E7EB', color: '#6B7280', textAlign: 'left' }}>
                                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Hourly Rate</th>
                                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Effective From</th>
                                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Effective To</th>
                                                <th style={{ padding: '12px 16px', fontWeight: 600 }}>Changed By</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {rateHistory.length > 0 ? (
                                                rateHistory.map((history) => (
                                                    <tr key={history.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                                        <td style={{ padding: '12px 16px', color: '#111827', fontWeight: 500 }}>
                                                            €{history.hourly_rate}
                                                        </td>
                                                        <td style={{ padding: '12px 16px', color: '#374151' }}>
                                                            {new Date(history.effective_from).toLocaleDateString()}
                                                        </td>
                                                        <td style={{ padding: '12px 16px', color: '#374151' }}>
                                                            {history.effective_to
                                                                ? new Date(history.effective_to).toLocaleDateString()
                                                                : <span style={{ color: '#059669', fontWeight: 500, backgroundColor: '#D1FAE5', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>Current</span>
                                                            }
                                                        </td>
                                                        <td style={{ padding: '12px 16px', color: '#6B7280' }}>
                                                            {history.changed_by_name || '-'}
                                                        </td>
                                                    </tr>
                                                ))
                                            ) : (
                                                <tr>
                                                    <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#9CA3AF' }}>
                                                        No rate history available
                                                    </td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </Card>

                            <Card title="Timeline" icon={Clock} iconColor="text-purple-600" iconBg="bg-purple-50">
                                <div className="space-y-3">
                                    <TimelineRow label="Created" date={employee.created_at} />
                                    <TimelineRow label="Submitted" date={employee.submitted_at} />
                                    <TimelineRow label="Approved" date={employee.approved_at} />
                                </div>
                            </Card>
                        </div>
                    )}

                    {/* DOCUMENTS */}
                    {activeTab === 'documents' && (
                        <div className="space-y-6">
                            <Card title="ID Document" icon={Shield} iconColor="text-indigo-600" iconBg="bg-indigo-50"
                                badge={employee.id_document_front_url || employee.id_document_back_url || employee.id_document_pdf_url ?
                                    <span className="text-xs font-medium text-emerald-600 flex items-center gap-1"><CheckCircle className="w-3.5 h-3.5" />Uploaded</span> :
                                    <span className="text-xs font-medium text-amber-600 flex items-center gap-1"><XCircle className="w-3.5 h-3.5" />Missing</span>}>
                                <div className="grid grid-cols-4 gap-4 mb-6 pb-6 border-b">
                                    <div>
                                        <label className="block text-xs font-medium text-gray-500 uppercase mb-1.5">Type</label>
                                        {isEditing ? (
                                            <select value={editForm.document_type_id || ''} onChange={e => setEditForm({ ...editForm, document_type_id: parseInt(e.target.value) })} className="w-full px-3 py-2 border rounded-lg text-sm">
                                                <option value="">Select...</option>
                                                {DOCUMENT_TYPES.map(dt => <option key={dt.id} value={dt.id}>{dt.name}</option>)}
                                            </select>
                                        ) : <p className="text-sm font-medium">{employee.document_type_name || '—'}</p>}
                                    </div>
                                    <Field label="Document Number" value={editForm.document_number} editing={isEditing} onChange={v => setEditForm({ ...editForm, document_number: v.toUpperCase() })} />
                                    <Field label="Issue Date" value={editForm.document_issue_date} editing={isEditing} type="date" onChange={v => setEditForm({ ...editForm, document_issue_date: v })} />
                                    <Field label="Expiry Date" value={editForm.document_expiry_date} editing={isEditing} type="date" onChange={v => setEditForm({ ...editForm, document_expiry_date: v })} />
                                </div>
                                {/* Upload ID Document Section */}
                                <div className="mt-2">
                                    <p className="text-sm font-medium text-gray-700 mb-1">Upload ID Document</p>
                                    <p className="text-xs text-gray-400 mb-4">Upload front and back, or a single PDF</p>

                                    <div className="grid grid-cols-2 gap-4 mb-4">
                                        <DocSlot title="Front Side" url={employee.id_document_front_url} field="id_document_front" accept="image/*" editing={isEditing} uploading={uploadingFile === 'id_document_front'} onUpload={handleFileUpload} onDelete={handleDeleteFile} />
                                        <DocSlot title="Back Side" url={employee.id_document_back_url} field="id_document_back" accept="image/*" editing={isEditing} uploading={uploadingFile === 'id_document_back'} onUpload={handleFileUpload} onDelete={handleDeleteFile} />
                                    </div>

                                    {/* OR Divider */}
                                    <div className="flex items-center gap-4 my-5">
                                        <div className="flex-1 border-t border-gray-200"></div>
                                        <span className="text-xs font-medium text-gray-400 uppercase">OR</span>
                                        <div className="flex-1 border-t border-gray-200"></div>
                                    </div>

                                    {/* PDF Upload */}
                                    <div className="max-w-xs">
                                        <DocSlot title="Upload PDF" url={employee.id_document_pdf_url} field="id_document_pdf" accept=".pdf,image/*" type="pdf" editing={isEditing} uploading={uploadingFile === 'id_document_pdf'} onUpload={handleFileUpload} onDelete={handleDeleteFile} />
                                    </div>
                                </div>
                            </Card>

                            <Card title="Driver's License" icon={Car} iconColor="text-orange-600" iconBg="bg-orange-50">
                                <div className="mb-4">
                                    {isEditing ? (
                                        <label className="flex items-center gap-3 cursor-pointer select-none group">
                                            <input
                                                type="checkbox"
                                                checked={editForm.has_drivers_license || false}
                                                onChange={e => setEditForm({ ...editForm, has_drivers_license: e.target.checked })}
                                                className="w-5 h-5 rounded border-gray-300 text-[#1E3A5F] focus:ring-[#1E3A5F] cursor-pointer"
                                                style={{ accentColor: '#1E3A5F' }}
                                            />
                                            <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900 transition-colors">Has Driver's License</span>
                                        </label>
                                    ) : (
                                        <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium ${employee.has_drivers_license ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                                            {employee.has_drivers_license ? <><CheckCircle className="w-4 h-4" />Yes</> : <><XCircle className="w-4 h-4" />No</>}
                                        </span>
                                    )}
                                </div>
                                {(employee.has_drivers_license || editForm.has_drivers_license) && (
                                    <>
                                        <div className="grid grid-cols-3 gap-4 mb-6 pb-6 border-b">
                                            <Field label="License Number" value={editForm.drivers_license_number} editing={isEditing} onChange={v => setEditForm({ ...editForm, drivers_license_number: v })} />
                                            <Field label="Issue Date" value={editForm.drivers_license_issue_date} editing={isEditing} type="date" onChange={v => setEditForm({ ...editForm, drivers_license_issue_date: v })} />
                                            <Field label="Expiry Date" value={editForm.drivers_license_expiry_date} editing={isEditing} type="date" onChange={v => setEditForm({ ...editForm, drivers_license_expiry_date: v })} />
                                        </div>
                                        <div className="mb-6 pb-6 border-b">
                                            <label className="block text-xs font-medium text-gray-500 uppercase mb-4">License Categories</label>
                                            <div className="grid grid-cols-4 gap-3">
                                                {LICENSE_CATEGORIES.map(cat => {
                                                    const sel = selectedCategories.includes(cat.code);
                                                    return (
                                                        <button key={cat.code} type="button" disabled={!isEditing} onClick={() => isEditing && toggleCategory(cat.code)}
                                                            className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all ${sel
                                                                ? 'bg-[#1E3A5F] text-white shadow-md'
                                                                : isEditing
                                                                    ? 'bg-gray-100 text-gray-700 hover:bg-[#1E3A5F]/10 hover:text-[#1E3A5F]'
                                                                    : 'bg-gray-100 text-gray-400'
                                                                }`}>
                                                            <span className="text-base">{cat.icon}</span>
                                                            <span>{cat.code}</span>
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </div>
                                        {/* Upload License Section */}
                                        <div className="mt-2">
                                            <p className="text-sm font-medium text-gray-700 mb-1">Upload License</p>
                                            <p className="text-xs text-gray-400 mb-4">Upload front and back, or a single PDF</p>

                                            <div className="grid grid-cols-2 gap-4">
                                                <DocSlot title="Front Side" url={employee.drivers_license_front_url} field="drivers_license_front" accept="image/*" editing={isEditing} uploading={uploadingFile === 'drivers_license_front'} onUpload={handleFileUpload} onDelete={handleDeleteFile} />
                                                <DocSlot title="Back Side" url={employee.drivers_license_back_url} field="drivers_license_back" accept="image/*" editing={isEditing} uploading={uploadingFile === 'drivers_license_back'} onUpload={handleFileUpload} onDelete={handleDeleteFile} />
                                            </div>
                                        </div>
                                    </>
                                )}
                            </Card>
                        </div>
                    )}

                    {/* CONTRACT */}
                    {activeTab === 'contract' && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                            {/* Loading State */}
                            {contractDataLoading && (
                                <div style={{
                                    backgroundColor: 'white',
                                    borderRadius: '16px',
                                    border: '1px solid #E5E7EB',
                                    padding: '60px 24px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '16px',
                                }}>
                                    <div style={{
                                        width: '40px',
                                        height: '40px',
                                        border: '4px solid #E5E7EB',
                                        borderTop: '4px solid #3B82F6',
                                        borderRadius: '50%',
                                        animation: 'spin 1s linear infinite',
                                    }} />
                                    <p style={{ color: '#6B7280', fontSize: '14px', margin: 0 }}>
                                        Loading contract data...
                                    </p>
                                    <style>{`@keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }`}</style>
                                </div>
                            )}

                            {/* Error State */}
                            {contractDataError && !contractDataLoading && (
                                <div style={{
                                    backgroundColor: '#FEF2F2',
                                    borderRadius: '16px',
                                    border: '2px solid #FCA5A5',
                                    padding: '40px 24px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    gap: '16px',
                                }}>
                                    <div style={{
                                        width: '48px',
                                        height: '48px',
                                        borderRadius: '50%',
                                        backgroundColor: '#FEE2E2',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                    }}>
                                        <AlertTriangle size={24} color="#DC2626" />
                                    </div>
                                    <div style={{ textAlign: 'center' }}>
                                        <p style={{ color: '#991B1B', fontSize: '16px', fontWeight: 600, margin: 0 }}>
                                            Failed to load contract data
                                        </p>
                                        <p style={{ color: '#DC2626', fontSize: '14px', margin: '8px 0 0' }}>
                                            {contractDataError}
                                        </p>
                                    </div>
                                    <button
                                        onClick={() => loadContractTypesAndAgencies()}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '12px 24px',
                                            backgroundColor: '#DC2626',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '10px',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <Clock size={16} /> Retry
                                    </button>
                                </div>
                            )}

                            {/* Content - only show when loaded and no error */}
                            {!contractDataLoading && !contractDataError && (
                                <>
                                    {/* Contract Type Card */}
                                    <div style={{
                                        backgroundColor: 'white',
                                        borderRadius: '16px',
                                        border: '1px solid #E5E7EB',
                                        overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            padding: '20px 24px',
                                            borderBottom: '1px solid #E5E7EB',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                        }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '10px',
                                                backgroundColor: '#DBEAFE',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}>
                                                <FileText size={20} color="#2563EB" />
                                            </div>
                                            <div>
                                                <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1F2937', margin: 0 }}>
                                                    Contract Type
                                                </h2>
                                                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                                                    Select the employment contract type
                                                </p>
                                            </div>
                                        </div>

                                        <div style={{ padding: '24px' }}>
                                            <div style={{ marginBottom: '20px' }}>
                                                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px', textTransform: 'uppercase' }}>
                                                    Contract Type *
                                                </label>
                                                {isEditing ? (
                                                    <select
                                                        value={editForm.contract_type_id || ''}
                                                        onChange={e => setEditForm({ ...editForm, contract_type_id: e.target.value ? parseInt(e.target.value) : null })}
                                                        style={{
                                                            width: '100%',
                                                            padding: '12px 16px',
                                                            fontSize: '15px',
                                                            lineHeight: '1.5',
                                                            border: '2px solid #E5E7EB',
                                                            borderRadius: '12px',
                                                            backgroundColor: '#F9FAFB',
                                                            color: '#1F2937',
                                                            outline: 'none',
                                                            cursor: 'pointer',
                                                            height: '48px'
                                                        }}
                                                    >
                                                        <option value="">Select contract type...</option>
                                                        {contractTypes.map(ct => (
                                                            <option key={ct.id} value={ct.id}>{ct.name} ({ct.code})</option>
                                                        ))}
                                                    </select>
                                                ) : (
                                                    <div style={{
                                                        padding: '14px 16px',
                                                        backgroundColor: '#F9FAFB',
                                                        borderRadius: '12px',
                                                        border: '1px solid #E5E7EB',
                                                    }}>
                                                        <span style={{ fontSize: '15px', fontWeight: 500, color: '#1F2937' }}>
                                                            {contractTypes.find(ct => ct.id === editForm.contract_type_id)?.name || (
                                                                <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Not set</span>
                                                            )}
                                                        </span>
                                                        {contractTypes.find(ct => ct.id === editForm.contract_type_id)?.code && (
                                                            <span style={{
                                                                marginLeft: '8px',
                                                                padding: '2px 8px',
                                                                backgroundColor: '#E0E7FF',
                                                                color: '#4338CA',
                                                                fontSize: '11px',
                                                                fontWeight: 600,
                                                                borderRadius: '4px',
                                                            }}>
                                                                {contractTypes.find(ct => ct.id === editForm.contract_type_id)?.code}
                                                            </span>
                                                        )}
                                                    </div>
                                                )}
                                            </div>

                                            {/* Show selected contract type requirements */}
                                            {editForm.contract_type_id && contractTypes.find(ct => ct.id === Number(editForm.contract_type_id)) && (
                                                <div style={{
                                                    display: 'flex',
                                                    gap: '12px',
                                                    flexWrap: 'wrap',
                                                }}>
                                                    {contractTypes.find(ct => ct.id === Number(editForm.contract_type_id))?.requires_end_date && (
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            padding: '6px 12px',
                                                            backgroundColor: '#FEF3C7',
                                                            color: '#92400E',
                                                            fontSize: '12px',
                                                            fontWeight: 500,
                                                            borderRadius: '8px',
                                                        }}>
                                                            <Calendar size={14} /> End Date Required
                                                        </span>
                                                    )}
                                                    {contractTypes.find(ct => ct.id === Number(editForm.contract_type_id))?.requires_agency && (
                                                        <span style={{
                                                            display: 'inline-flex',
                                                            alignItems: 'center',
                                                            gap: '6px',
                                                            padding: '6px 12px',
                                                            backgroundColor: '#F3E8FF',
                                                            color: '#7C3AED',
                                                            fontSize: '12px',
                                                            fontWeight: 500,
                                                            borderRadius: '8px',
                                                        }}>
                                                            <Building2 size={14} /> Agency Required
                                                        </span>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Agency Card - Only show for agency contracts */}
                                    {contractTypes.find(ct => ct.id === Number(editForm.contract_type_id))?.requires_agency && (
                                        <div style={{
                                            backgroundColor: 'white',
                                            borderRadius: '16px',
                                            border: '2px solid #DDD6FE',
                                            overflow: 'hidden',
                                        }}>
                                            <div style={{
                                                padding: '20px 24px',
                                                borderBottom: '1px solid #DDD6FE',
                                                backgroundColor: '#FAF5FF',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                            }}>
                                                <div style={{
                                                    width: '40px',
                                                    height: '40px',
                                                    borderRadius: '10px',
                                                    backgroundColor: '#DDD6FE',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}>
                                                    <Building2 size={20} color="#7C3AED" />
                                                </div>
                                                <div>
                                                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#5B21B6', margin: 0 }}>
                                                        Agency Assignment
                                                    </h2>
                                                    <p style={{ fontSize: '13px', color: '#7C3AED', margin: 0 }}>
                                                        Required for Uitzendkracht contracts
                                                    </p>
                                                </div>
                                            </div>

                                            <div style={{ padding: '24px' }}>
                                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                                    {/* Agency Select */}
                                                    <div>
                                                        <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#7C3AED', marginBottom: '8px', textTransform: 'uppercase' }}>
                                                            Agency *
                                                        </label>
                                                        {isEditing ? (
                                                            <select
                                                                value={editForm.current_agency_id || ''}
                                                                onChange={e => setEditForm({ ...editForm, current_agency_id: e.target.value ? parseInt(e.target.value) : null })}
                                                                style={{
                                                                    width: '100%',
                                                                    padding: '12px 16px',
                                                                    fontSize: '15px',
                                                                    lineHeight: '1.5',
                                                                    border: '2px solid #DDD6FE',
                                                                    borderRadius: '12px',
                                                                    backgroundColor: '#FAF5FF',
                                                                    color: '#5B21B6',
                                                                    outline: 'none',
                                                                    cursor: 'pointer',
                                                                    height: '48px'
                                                                }}
                                                            >
                                                                <option value="">Select agency...</option>
                                                                {agencies.map(ag => (
                                                                    <option key={ag.id} value={ag.id}>{ag.name} ({ag.code})</option>
                                                                ))}
                                                            </select>
                                                        ) : (
                                                            <div style={{
                                                                padding: '14px 16px',
                                                                backgroundColor: '#FAF5FF',
                                                                borderRadius: '12px',
                                                                border: '1px solid #DDD6FE',
                                                            }}>
                                                                <span style={{ fontSize: '15px', fontWeight: 500, color: '#5B21B6' }}>
                                                                    {agencies.find(ag => ag.id === editForm.current_agency_id)?.name || (
                                                                        <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Not set</span>
                                                                    )}
                                                                </span>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {/* Contract Dates Card */}
                                    <div style={{
                                        backgroundColor: 'white',
                                        borderRadius: '16px',
                                        border: '1px solid #E5E7EB',
                                        overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            padding: '20px 24px',
                                            borderBottom: '1px solid #E5E7EB',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                        }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '10px',
                                                backgroundColor: '#D1FAE5',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}>
                                                <Calendar size={20} color="#059669" />
                                            </div>
                                            <div>
                                                <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1F2937', margin: 0 }}>
                                                    Contract Period
                                                </h2>
                                                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                                                    Start and end dates of the contract
                                                </p>
                                            </div>
                                        </div>

                                        <div style={{ padding: '24px' }}>
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px', textTransform: 'uppercase' }}>
                                                        Start Date
                                                    </label>
                                                    {isEditing ? (
                                                        <input
                                                            type="date"
                                                            value={editForm.contract_start_date || ''}
                                                            onChange={e => setEditForm({ ...editForm, contract_start_date: e.target.value })}
                                                            style={{
                                                                width: '100%',
                                                                padding: '14px 16px',
                                                                fontSize: '15px',
                                                                border: '2px solid #E5E7EB',
                                                                borderRadius: '12px',
                                                                backgroundColor: '#F9FAFB',
                                                                outline: 'none',
                                                            }}
                                                        />
                                                    ) : (
                                                        <div style={{
                                                            padding: '14px 16px',
                                                            backgroundColor: '#F9FAFB',
                                                            borderRadius: '12px',
                                                            border: '1px solid #E5E7EB',
                                                        }}>
                                                            <span style={{ fontSize: '15px', fontWeight: 500, color: '#1F2937' }}>
                                                                {editForm.contract_start_date || (
                                                                    <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Not set</span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>

                                                <div>
                                                    <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#374151', marginBottom: '8px', textTransform: 'uppercase' }}>
                                                        End Date {contractTypes.find(ct => ct.id === Number(editForm.contract_type_id))?.requires_end_date && (
                                                            <span style={{ color: '#DC2626' }}>*</span>
                                                        )}
                                                    </label>
                                                    {isEditing ? (
                                                        <input
                                                            type="date"
                                                            value={editForm.contract_end_date || ''}
                                                            onChange={e => setEditForm({ ...editForm, contract_end_date: e.target.value })}
                                                            style={{
                                                                width: '100%',
                                                                padding: '14px 16px',
                                                                fontSize: '15px',
                                                                border: `2px solid ${contractTypes.find(ct => ct.id === Number(editForm.contract_type_id))?.requires_end_date ? '#FCA5A5' : '#E5E7EB'}`,
                                                                borderRadius: '12px',
                                                                backgroundColor: '#F9FAFB',
                                                                outline: 'none',
                                                            }}
                                                        />
                                                    ) : (
                                                        <div style={{
                                                            padding: '14px 16px',
                                                            backgroundColor: '#F9FAFB',
                                                            borderRadius: '12px',
                                                            border: '1px solid #E5E7EB',
                                                        }}>
                                                            <span style={{ fontSize: '15px', fontWeight: 500, color: '#1F2937' }}>
                                                                {editForm.contract_end_date || (
                                                                    <span style={{ color: '#9CA3AF', fontStyle: 'italic' }}>Not set (Indefinite)</span>
                                                                )}
                                                            </span>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Contract History Card */}
                                    <div style={{
                                        backgroundColor: 'white',
                                        borderRadius: '16px',
                                        border: '1px solid #E5E7EB',
                                        overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            padding: '20px 24px',
                                            borderBottom: '1px solid #E5E7EB',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                        }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '10px',
                                                backgroundColor: '#DBEAFE',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}>
                                                <FileText size={20} color="#3B82F6" />
                                            </div>
                                            <div>
                                                <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1F2937', margin: 0 }}>
                                                    Contract History
                                                </h2>
                                                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                                                    All historical contracts for this employee
                                                </p>
                                            </div>
                                        </div>

                                        <div style={{ padding: '24px' }}>
                                            {contractHistory.length > 0 ? (
                                                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                                                    <thead>
                                                        <tr style={{ borderBottom: '1px solid #E5E7EB', color: '#6B7280', textAlign: 'left' }}>
                                                            <th style={{ padding: '12px 8px', fontWeight: 600 }}>Rate</th>
                                                            <th style={{ padding: '12px 8px', fontWeight: 600 }}>From</th>
                                                            <th style={{ padding: '12px 8px', fontWeight: 600 }}>To</th>
                                                            <th style={{ padding: '12px 8px', fontWeight: 600 }}>Uploaded By</th>
                                                            <th style={{ padding: '12px 8px', fontWeight: 600 }}>Document</th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {contractHistory.map((contract) => (
                                                            <tr key={contract.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                                                <td style={{ padding: '12px 8px', color: '#111827', fontWeight: 500 }}>
                                                                    €{contract.hourly_rate}
                                                                </td>
                                                                <td style={{ padding: '12px 8px', color: '#374151' }}>
                                                                    {new Date(contract.effective_from).toLocaleDateString()}
                                                                </td>
                                                                <td style={{ padding: '12px 8px', color: '#374151' }}>
                                                                    {contract.effective_to
                                                                        ? new Date(contract.effective_to).toLocaleDateString()
                                                                        : <span style={{ color: '#059669', fontWeight: 500, backgroundColor: '#D1FAE5', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>Current</span>
                                                                    }
                                                                </td>
                                                                <td style={{ padding: '12px 8px', color: '#6B7280' }}>
                                                                    {contract.uploaded_by_name || '-'}
                                                                </td>
                                                                <td style={{ padding: '12px 8px' }}>
                                                                    {contract.contract_document_url && (
                                                                        <a
                                                                            href={contract.contract_document_url}
                                                                            target="_blank"
                                                                            rel="noopener noreferrer"
                                                                            style={{
                                                                                display: 'inline-flex',
                                                                                alignItems: 'center',
                                                                                gap: '4px',
                                                                                color: '#3B82F6',
                                                                                textDecoration: 'none',
                                                                                fontSize: '13px',
                                                                                fontWeight: 500,
                                                                            }}
                                                                        >
                                                                            <Eye size={14} />
                                                                            View
                                                                        </a>
                                                                    )}
                                                                </td>
                                                            </tr>
                                                        ))}
                                                    </tbody>
                                                </table>
                                            ) : (
                                                <div style={{ textAlign: 'center', padding: '24px', color: '#9CA3AF' }}>
                                                    <FileText size={32} style={{ opacity: 0.5, marginBottom: '8px' }} />
                                                    <p>No contract history available</p>
                                                </div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Contract Document Card */}
                                    <div style={{
                                        backgroundColor: 'white',
                                        borderRadius: '16px',
                                        border: '1px solid #E5E7EB',
                                        overflow: 'hidden',
                                    }}>
                                        <div style={{
                                            padding: '20px 24px',
                                            borderBottom: '1px solid #E5E7EB',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '12px',
                                        }}>
                                            <div style={{
                                                width: '40px',
                                                height: '40px',
                                                borderRadius: '10px',
                                                backgroundColor: '#FEF3C7',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                            }}>
                                                <Upload size={20} color="#D97706" />
                                            </div>
                                            <div>
                                                <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1F2937', margin: 0 }}>
                                                    Contract Document
                                                </h2>
                                                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>
                                                    Upload signed contract PDF
                                                </p>
                                            </div>
                                        </div>

                                        <div style={{ padding: '24px' }}>
                                            <div style={{ maxWidth: '300px' }}>
                                                <DocSlot
                                                    title="Contract"
                                                    url={employee.contract_document_url}
                                                    field="contract_document"
                                                    accept=".pdf,.doc,.docx"
                                                    type="pdf"
                                                    editing={isEditing}
                                                    uploading={uploadingFile === 'contract_document'}
                                                    onUpload={handleFileUpload}
                                                    onDelete={handleDeleteFile}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* Certificates Tab */}
                    {activeTab === 'certificates' && (
                        <div style={{ maxWidth: '800px' }}>
                            <div style={{
                                backgroundColor: 'white',
                                borderRadius: '16px',
                                border: '1px solid #E5E7EB',
                                overflow: 'hidden',
                                marginBottom: '24px',
                            }}>
                                <div style={{
                                    padding: '20px 24px',
                                    borderBottom: '1px solid #E5E7EB',
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'space-between',
                                }}>
                                    <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#1F2937', margin: 0 }}>
                                        Employee Certificates
                                    </h2>
                                    <button
                                        onClick={() => setShowAddCertificateModal(true)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            padding: '8px 16px',
                                            backgroundColor: '#3B82F6',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '8px',
                                            fontSize: '14px',
                                            fontWeight: 500,
                                            cursor: 'pointer',
                                        }}
                                    >
                                        <Plus size={16} />
                                        Add Certificate
                                    </button>
                                </div>

                                <div style={{ padding: '24px' }}>
                                    {certificatesLoading ? (
                                        <div style={{ textAlign: 'center', padding: '40px' }}>
                                            <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                                            <p className="text-gray-500">Loading certificates...</p>
                                        </div>
                                    ) : employeeCertificates.length === 0 ? (
                                        <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>
                                            <Award size={48} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
                                            <p style={{ fontSize: '16px', fontWeight: 500 }}>No certificates found</p>
                                            <p style={{ fontSize: '14px' }}>Click "Add Certificate" to upload one</p>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'grid', gap: '16px' }}>
                                            {employeeCertificates.map((cert) => (
                                                <div key={cert.id} style={{
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'space-between',
                                                    padding: '16px',
                                                    backgroundColor: '#F9FAFB',
                                                    borderRadius: '12px',
                                                    border: '1px solid #E5E7EB',
                                                }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                        <div style={{
                                                            width: '40px',
                                                            height: '40px',
                                                            borderRadius: '8px',
                                                            backgroundColor: '#DBEAFE',
                                                            display: 'flex',
                                                            alignItems: 'center',
                                                            justifyContent: 'center',
                                                        }}>
                                                            <Award size={20} color="#2563EB" />
                                                        </div>
                                                        <div>
                                                            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#1F2937', margin: '0 0 4px 0' }}>
                                                                {cert.certificate_type_name}
                                                            </h3>
                                                            <div style={{ display: 'flex', gap: '12px', fontSize: '13px', color: '#6B7280' }}>
                                                                {cert.diploma_number && (
                                                                    <span>#{cert.diploma_number}</span>
                                                                )}
                                                                {cert.expiry_date && (
                                                                    <span style={{ color: cert.is_expired ? '#DC2626' : '#6B7280' }}>
                                                                        Expires: {cert.expiry_date}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                        <button
                                                            onClick={() => { setSelectedCertificate(cert); setShowViewCertificateModal(true); }}
                                                            style={{
                                                                padding: '8px',
                                                                color: '#6B7280',
                                                                borderRadius: '8px',
                                                                border: '1px solid #E5E7EB',
                                                                backgroundColor: 'white',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                            }}
                                                        >
                                                            <Eye size={16} />
                                                        </button>
                                                        <button
                                                            onClick={() => handleDeleteCertificate(cert.id)}
                                                            style={{
                                                                padding: '8px',
                                                                color: '#DC2626',
                                                                borderRadius: '8px',
                                                                border: '1px solid #FCA5A5',
                                                                backgroundColor: '#FEF2F2',
                                                                cursor: 'pointer',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                            }}
                                                        >
                                                            <Trash2 size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Add Certificate Modal */}
                    {showAddCertificateModal && (
                        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowAddCertificateModal(false)} />
                            <div style={{
                                position: 'relative',
                                backgroundColor: 'white',
                                borderRadius: '16px',
                                padding: '24px',
                                maxWidth: '500px',
                                width: '100%',
                                maxHeight: '90vh',
                                overflow: 'auto',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                                    <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#111827', margin: 0 }}>Add Certificate</h3>
                                    <button onClick={() => setShowAddCertificateModal(false)}><X size={20} color="#6B7280" /></button>
                                </div>

                                <form onSubmit={handleAddCertificate}>
                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
                                            Certificate Type *
                                        </label>
                                        <select
                                            value={certificateForm.certificate_type_id}
                                            onChange={e => setCertificateForm({ ...certificateForm, certificate_type_id: e.target.value })}
                                            required
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid #D1D5DB',
                                                fontSize: '14px',
                                            }}
                                        >
                                            <option value="">Select a type...</option>
                                            {certificateTypes.map(type => (
                                                <option key={type.id} value={type.id}>{type.name}</option>
                                            ))}
                                        </select>
                                    </div>

                                    <div style={{ marginBottom: '16px' }}>
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
                                            Diploma / Certificate Number *
                                        </label>
                                        <input
                                            type="text"
                                            value={certificateForm.diploma_number}
                                            onChange={e => setCertificateForm({ ...certificateForm, diploma_number: e.target.value })}
                                            style={{
                                                width: '100%',
                                                padding: '10px 12px',
                                                borderRadius: '8px',
                                                border: '1px solid #D1D5DB',
                                                fontSize: '14px',
                                            }}
                                        />
                                    </div>

                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
                                                Start Date *
                                            </label>
                                            <input
                                                type="date"
                                                value={certificateForm.issue_date}
                                                onChange={e => setCertificateForm({ ...certificateForm, issue_date: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 12px',
                                                    borderRadius: '8px',
                                                    border: '1px solid #D1D5DB',
                                                    fontSize: '14px',
                                                }}
                                            />
                                        </div>
                                        <div>
                                            <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
                                                Expiry Date *
                                            </label>
                                            <input
                                                type="date"
                                                value={certificateForm.expiry_date}
                                                onChange={e => setCertificateForm({ ...certificateForm, expiry_date: e.target.value })}
                                                style={{
                                                    width: '100%',
                                                    padding: '10px 12px',
                                                    borderRadius: '8px',
                                                    border: '1px solid #D1D5DB',
                                                    fontSize: '14px',
                                                }}
                                            />
                                        </div>
                                    </div>

                                    <div style={{ marginBottom: '24px' }}>
                                        <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
                                            Upload Type
                                        </label>
                                        <div style={{ display: 'flex', gap: '4px', padding: '4px', backgroundColor: '#F3F4F6', borderRadius: '8px', marginBottom: '16px' }}>
                                            <button
                                                type="button"
                                                onClick={() => { setUploadMode('pdf'); setCertificateFile(null); setCertificateFileBack(null); }}
                                                style={{
                                                    flex: 1,
                                                    padding: '8px',
                                                    fontSize: '14px',
                                                    fontWeight: 500,
                                                    borderRadius: '6px',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    backgroundColor: uploadMode === 'pdf' ? 'white' : 'transparent',
                                                    color: uploadMode === 'pdf' ? '#1E3A5F' : '#6B7280',
                                                    boxShadow: uploadMode === 'pdf' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                                    transition: 'all 0.2s',
                                                }}
                                            >
                                                PDF Document
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => { setUploadMode('images'); setCertificateFile(null); setCertificateFileBack(null); }}
                                                style={{
                                                    flex: 1,
                                                    padding: '8px',
                                                    fontSize: '14px',
                                                    fontWeight: 500,
                                                    borderRadius: '6px',
                                                    border: 'none',
                                                    cursor: 'pointer',
                                                    backgroundColor: uploadMode === 'images' ? 'white' : 'transparent',
                                                    color: uploadMode === 'images' ? '#1E3A5F' : '#6B7280',
                                                    boxShadow: uploadMode === 'images' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none',
                                                    transition: 'all 0.2s',
                                                }}
                                            >
                                                Photos (Front & Back)
                                            </button>
                                        </div>

                                        {uploadMode === 'pdf' ? (
                                            <div>
                                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
                                                    Certificate PDF *
                                                </label>
                                                <div style={{ position: 'relative' }}>
                                                    <input
                                                        type="file"
                                                        onChange={e => setCertificateFile(e.target.files?.[0] || null)}
                                                        required={uploadMode === 'pdf'}
                                                        accept=".pdf"
                                                        style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 10 }}
                                                    />
                                                    <div style={{
                                                        border: '2px dashed #D1D5DB', borderRadius: '12px', padding: '24px', backgroundColor: '#F9FAFB', textAlign: 'center', transition: 'all 0.2s'
                                                    }}>
                                                        <div style={{ width: '40px', height: '40px', borderRadius: '20px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                                                            <Upload size={20} color="#3B82F6" />
                                                        </div>
                                                        <p style={{ fontSize: '14px', fontWeight: 600, color: '#1F2937', margin: 0 }}>{certificateFile ? certificateFile.name : 'Upload PDF Certificate'}</p>
                                                        <p style={{ fontSize: '12px', color: certificateFile ? '#16A34A' : '#9CA3AF', margin: 0 }}>{certificateFile ? 'File selected' : 'PDF (max 10MB)'}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        ) : (
                                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
                                                        Front Side *
                                                    </label>
                                                    <div style={{ position: 'relative' }}>
                                                        <input
                                                            type="file"
                                                            onChange={e => setCertificateFile(e.target.files?.[0] || null)}
                                                            required={uploadMode === 'images'}
                                                            accept="image/*"
                                                            style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 10 }}
                                                        />
                                                        <div style={{
                                                            border: '2px dashed #D1D5DB', borderRadius: '12px', padding: '24px 12px', backgroundColor: '#F9FAFB', textAlign: 'center'
                                                        }}>
                                                            <div style={{ width: '32px', height: '32px', borderRadius: '16px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                                                                <ImageIcon size={16} color="#3B82F6" />
                                                            </div>
                                                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{certificateFile ? certificateFile.name : 'Front Photo'}</p>
                                                            <p style={{ fontSize: '11px', color: certificateFile ? '#16A34A' : '#9CA3AF' }}>{certificateFile ? 'Selected' : 'JPG/PNG'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div>
                                                    <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>
                                                        Back Side *
                                                    </label>
                                                    <div style={{ position: 'relative' }}>
                                                        <input
                                                            type="file"
                                                            onChange={e => setCertificateFileBack(e.target.files?.[0] || null)}
                                                            required={uploadMode === 'images'}
                                                            accept="image/*"
                                                            style={{ opacity: 0, position: 'absolute', inset: 0, width: '100%', height: '100%', cursor: 'pointer', zIndex: 10 }}
                                                        />
                                                        <div style={{
                                                            border: '2px dashed #D1D5DB', borderRadius: '12px', padding: '24px 12px', backgroundColor: '#F9FAFB', textAlign: 'center'
                                                        }}>
                                                            <div style={{ width: '32px', height: '32px', borderRadius: '16px', backgroundColor: '#EFF6FF', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 8px' }}>
                                                                <ImageIcon size={16} color="#3B82F6" />
                                                            </div>
                                                            <p style={{ fontSize: '13px', fontWeight: 600, color: '#1F2937', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{certificateFileBack ? certificateFileBack.name : 'Back Photo'}</p>
                                                            <p style={{ fontSize: '11px', color: certificateFileBack ? '#16A34A' : '#9CA3AF' }}>{certificateFileBack ? 'Selected' : 'JPG/PNG'}</p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                        <button
                                            type="button"
                                            onClick={() => setShowAddCertificateModal(false)}
                                            style={{
                                                padding: '10px 16px',
                                                backgroundColor: 'white',
                                                border: '1px solid #D1D5DB',
                                                borderRadius: '8px',
                                                fontSize: '14px',
                                                fontWeight: 500,
                                                color: '#374151',
                                                cursor: 'pointer',
                                            }}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="submit"
                                            disabled={
                                                savingCertificate ||
                                                !certificateForm.certificate_type_id ||
                                                !certificateForm.diploma_number ||
                                                !certificateForm.issue_date ||
                                                !certificateForm.expiry_date ||
                                                (uploadMode === 'pdf' && !certificateFile) ||
                                                (uploadMode === 'images' && (!certificateFile || !certificateFileBack))
                                            }
                                            style={{
                                                padding: '10px 16px',
                                                backgroundColor: (
                                                    savingCertificate ||
                                                    !certificateForm.certificate_type_id ||
                                                    !certificateForm.diploma_number ||
                                                    !certificateForm.issue_date ||
                                                    !certificateForm.expiry_date ||
                                                    (uploadMode === 'pdf' && !certificateFile) ||
                                                    (uploadMode === 'images' && (!certificateFile || !certificateFileBack))
                                                ) ? '#9CA3AF' : '#3B82F6',
                                                border: 'none',
                                                borderRadius: '8px',
                                                color: 'white',
                                                fontSize: '14px',
                                                fontWeight: 500,
                                                cursor: (
                                                    savingCertificate ||
                                                    !certificateForm.certificate_type_id ||
                                                    !certificateForm.diploma_number ||
                                                    !certificateForm.issue_date ||
                                                    !certificateForm.expiry_date ||
                                                    (uploadMode === 'pdf' && !certificateFile) ||
                                                    (uploadMode === 'images' && (!certificateFile || !certificateFileBack))
                                                ) ? 'not-allowed' : 'pointer',
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '8px',
                                            }}
                                        >
                                            {savingCertificate ? 'Saving...' : 'Save Certificate'}
                                        </button>
                                    </div>
                                </form>
                            </div>
                        </div>
                    )}

                    {/* View Certificate Modal */}
                    {showViewCertificateModal && selectedCertificate && (
                        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowViewCertificateModal(false)} />
                            <div style={{
                                position: 'relative',
                                backgroundColor: 'white',
                                borderRadius: '16px',
                                padding: '24px',
                                maxWidth: '600px',
                                width: '100%',
                                maxHeight: '90vh',
                                overflow: 'auto',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                    <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', margin: 0 }}>Certificate Details</h3>
                                    <button onClick={() => setShowViewCertificateModal(false)}><X size={20} color="#6B7280" /></button>
                                </div>

                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '24px' }}>
                                    <div>
                                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: '4px' }}>Type</p>
                                        <p style={{ fontSize: '15px', fontWeight: 600, color: '#1F2937' }}>{selectedCertificate.certificate_type_name}</p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: '4px' }}>Status</p>
                                        <span style={{
                                            display: 'inline-flex',
                                            alignItems: 'center',
                                            padding: '4px 10px',
                                            borderRadius: '9999px',
                                            fontSize: '12px',
                                            fontWeight: 600,
                                            backgroundColor: selectedCertificate.is_expired ? '#FEE2E2' : '#DCFCE7',
                                            color: selectedCertificate.is_expired ? '#991B1B' : '#166534',
                                        }}>
                                            {selectedCertificate.is_expired ? 'Expired' : 'Active'}
                                        </span>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: '4px' }}>Start Date</p>
                                        <p style={{ fontSize: '14px', color: '#1F2937' }}>{selectedCertificate.issue_date || 'N/A'}</p>
                                    </div>
                                    <div>
                                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: '4px' }}>Expire Date</p>
                                        <p style={{ fontSize: '14px', color: '#1F2937' }}>{selectedCertificate.expiry_date || 'N/A'}</p>
                                    </div>
                                    <div style={{ gridColumn: 'span 2' }}>
                                        <p style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: '4px' }}>Diploma / Certificate Number</p>
                                        <p style={{ fontSize: '14px', color: '#1F2937', fontFamily: 'monospace' }}>{selectedCertificate.diploma_number || 'N/A'}</p>
                                    </div>
                                </div>

                                <div style={{ marginBottom: '20px' }}>
                                    <p style={{ fontSize: '12px', fontWeight: 600, color: '#6B7280', textTransform: 'uppercase', marginBottom: '8px' }}>Certificate Document</p>

                                    {selectedCertificate.certificate_file_back ? (
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                            {/* Front Side Card */}
                                            <div style={{
                                                border: '1px solid #E5E7EB',
                                                borderRadius: '12px',
                                                backgroundColor: 'white',
                                                overflow: 'hidden'
                                            }}>
                                                <div style={{
                                                    aspectRatio: '1.58/1', // Credit card ratio
                                                    backgroundColor: '#F9FAFB',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    borderBottom: '1px solid #F3F4F6'
                                                }}>
                                                    <img
                                                        src={selectedCertificate.certificate_file}
                                                        alt="Front Side"
                                                        style={{ width: '100%', height: '100%', objectFit: 'contain', maxHeight: '100%' }}
                                                    />
                                                </div>
                                                <div style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>Front Side</span>
                                                    <a
                                                        href={selectedCertificate.certificate_file}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{
                                                            padding: '6px 12px',
                                                            backgroundColor: 'white',
                                                            border: '1px solid #D1D5DB',
                                                            borderRadius: '6px',
                                                            fontSize: '12px',
                                                            fontWeight: 500,
                                                            color: '#374151',
                                                            textDecoration: 'none',
                                                            cursor: 'pointer',
                                                            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                                                        }}
                                                    >
                                                        View
                                                    </a>
                                                </div>
                                            </div>

                                            {/* Back Side Card */}
                                            <div style={{
                                                border: '1px solid #E5E7EB',
                                                borderRadius: '12px',
                                                backgroundColor: 'white',
                                                overflow: 'hidden'
                                            }}>
                                                <div style={{
                                                    aspectRatio: '1.58/1',
                                                    backgroundColor: '#F9FAFB',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    borderBottom: '1px solid #F3F4F6'
                                                }}>
                                                    <img
                                                        src={selectedCertificate.certificate_file_back}
                                                        alt="Back Side"
                                                        style={{ width: '100%', height: '100%', objectFit: 'contain', maxHeight: '100%' }}
                                                    />
                                                </div>
                                                <div style={{ padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                                    <span style={{ fontSize: '13px', fontWeight: 500, color: '#374151' }}>Back Side</span>
                                                    <a
                                                        href={selectedCertificate.certificate_file_back!}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        style={{
                                                            padding: '6px 12px',
                                                            backgroundColor: 'white',
                                                            border: '1px solid #D1D5DB',
                                                            borderRadius: '6px',
                                                            fontSize: '12px',
                                                            fontWeight: 500,
                                                            color: '#374151',
                                                            textDecoration: 'none',
                                                            cursor: 'pointer',
                                                            boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                                                        }}
                                                    >
                                                        View
                                                    </a>
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{
                                            border: '1px solid #E5E7EB',
                                            borderRadius: '12px',
                                            padding: '16px',
                                            backgroundColor: 'white', // Changed to white as per screenshot usually (or keep transparent if card is on grey)
                                            // The user image shows the card inside a modal. 
                                            // Let's stick to the 'card' look.
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'space-between',
                                        }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                                                <div style={{
                                                    width: '48px',
                                                    height: '48px',
                                                    borderRadius: '8px',
                                                    backgroundColor: '#EFF6FF',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                }}>
                                                    <FileText size={24} color="#3B82F6" />
                                                </div>
                                                <div style={{ overflow: 'hidden' }}>
                                                    <p style={{ fontSize: '14px', fontWeight: 500, color: '#374151', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '300px' }}>
                                                        {selectedCertificate.certificate_file.split('/').pop()}
                                                    </p>
                                                    <p style={{ fontSize: '13px', color: '#6B7280' }}>PDF Document</p>
                                                </div>
                                            </div>
                                            <a
                                                href={selectedCertificate.certificate_file}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                style={{
                                                    padding: '8px 16px',
                                                    backgroundColor: 'white',
                                                    border: '1px solid #D1D5DB',
                                                    borderRadius: '8px',
                                                    fontSize: '14px',
                                                    fontWeight: 500,
                                                    color: '#374151',
                                                    textDecoration: 'none',
                                                    cursor: 'pointer',
                                                    boxShadow: '0 1px 2px 0 rgba(0, 0, 0, 0.05)'
                                                }}
                                            >
                                                Download
                                            </a>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Modals */}
                    {showApproveModal && (
                        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowApproveModal(false)} />
                            <div style={{
                                position: 'relative',
                                backgroundColor: 'white',
                                borderRadius: '16px',
                                padding: '32px',
                                maxWidth: '420px',
                                width: '100%',
                                textAlign: 'center',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            }}>
                                {/* Success Icon */}
                                <div style={{ width: '64px', height: '64px', borderRadius: '32px', backgroundColor: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                    <CheckCircle style={{ width: '32px', height: '32px', color: '#16A34A' }} />
                                </div>

                                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Approve Employee</h3>
                                <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '24px' }}>
                                    Are you sure you want to approve <strong>{employee.first_name} {employee.last_name}</strong>?
                                    This will activate their account.
                                </p>

                                {/* Action Buttons */}
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        onClick={() => setShowApproveModal(false)}
                                        style={{
                                            flex: 1,
                                            padding: '14px',
                                            backgroundColor: 'white',
                                            border: '2px solid #E5E7EB',
                                            borderRadius: '12px',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleApprove}
                                        style={{
                                            flex: 1,
                                            padding: '14px',
                                            backgroundColor: '#16A34A',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '12px',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <CheckCircle style={{ width: '16px', height: '16px' }} /> Approve
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Rate Change Contract Modal */}
                    {showRateChangeModal && (
                        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => { setShowRateChangeModal(false); setPendingRateChange(null); }} />
                            <div style={{
                                position: 'relative',
                                backgroundColor: 'white',
                                borderRadius: '16px',
                                padding: '32px',
                                maxWidth: '480px',
                                width: '100%',
                                textAlign: 'center',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            }}>
                                <div style={{ width: '64px', height: '64px', borderRadius: '32px', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                    <FileText style={{ width: '32px', height: '32px', color: '#D97706' }} />
                                </div>

                                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Rate Change Detected</h3>
                                <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '8px' }}>
                                    You're changing the hourly rate to <strong>€{pendingRateChange}</strong>
                                </p>
                                <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '24px' }}>
                                    Do you want to upload a new contract document for this rate change?
                                </p>

                                <div style={{ display: 'flex', gap: '12px', marginBottom: '16px' }}>
                                    <button
                                        onClick={() => performSave(false)}
                                        disabled={saving}
                                        style={{
                                            flex: 1,
                                            padding: '14px',
                                            backgroundColor: 'white',
                                            border: '2px solid #E5E7EB',
                                            borderRadius: '12px',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        No, Save Rate Only
                                    </button>
                                    <label
                                        style={{
                                            flex: 1,
                                            padding: '14px',
                                            backgroundColor: '#7C3AED',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '12px',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <Upload style={{ width: '16px', height: '16px' }} />
                                        {saving ? 'Uploading...' : 'Yes, Upload Contract'}
                                        <input
                                            type="file"
                                            accept=".pdf,.doc,.docx"
                                            style={{ display: 'none' }}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) handleContractFileSelected(file);
                                            }}
                                        />
                                    </label>
                                </div>

                                <button
                                    onClick={() => { setShowRateChangeModal(false); setPendingRateChange(null); }}
                                    style={{
                                        width: '100%',
                                        padding: '10px',
                                        backgroundColor: 'transparent',
                                        border: 'none',
                                        fontSize: '13px',
                                        color: '#9CA3AF',
                                        cursor: 'pointer',
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}
                    {showRejectModal && (
                        <div style={{ position: 'fixed', inset: 0, zIndex: 9999, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                            <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }} onClick={() => setShowRejectModal(false)} />
                            <div style={{
                                position: 'relative',
                                backgroundColor: 'white',
                                borderRadius: '16px',
                                padding: '32px',
                                maxWidth: '420px',
                                width: '100%',
                                textAlign: 'center',
                                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
                            }}>
                                {/* Warning Icon */}
                                <div style={{ width: '64px', height: '64px', borderRadius: '32px', backgroundColor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                    <AlertTriangle style={{ width: '32px', height: '32px', color: '#DC2626' }} />
                                </div>

                                <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Reject Employee</h3>
                                <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '20px' }}>
                                    Please provide a reason for rejecting <strong>{employee.first_name} {employee.last_name}</strong>.
                                </p>

                                <div style={{ position: 'relative' }}>
                                    <textarea
                                        value={rejectReason}
                                        onChange={e => setRejectReason(e.target.value)}
                                        placeholder="Enter rejection reason (minimum 10 characters)..."
                                        style={{
                                            width: '100%',
                                            padding: '14px 16px',
                                            backgroundColor: '#F9FAFB',
                                            border: `2px solid ${rejectReason.length > 0 && rejectReason.trim().length < 10 ? '#FCA5A5' : '#E5E7EB'}`,
                                            borderRadius: '12px',
                                            fontSize: '14px',
                                            outline: 'none',
                                            resize: 'none',
                                            height: '120px',
                                            marginBottom: '8px',
                                            textAlign: 'left',
                                            fontFamily: 'inherit',
                                            boxSizing: 'border-box',
                                        }}
                                    />
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                                        <span style={{
                                            fontSize: '12px',
                                            color: rejectReason.length > 0 && rejectReason.trim().length < 10 ? '#DC2626' : '#9CA3AF',
                                        }}>
                                            {rejectReason.trim().length < 10 ? `Minimum 10 characters required (${rejectReason.trim().length}/10)` : '✓ Minimum met'}
                                        </span>
                                        <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
                                            {rejectReason.trim().length} characters
                                        </span>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div style={{ display: 'flex', gap: '12px' }}>
                                    <button
                                        onClick={() => setShowRejectModal(false)}
                                        style={{
                                            flex: 1,
                                            padding: '14px',
                                            backgroundColor: 'white',
                                            border: '2px solid #E5E7EB',
                                            borderRadius: '12px',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            cursor: 'pointer',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={handleReject}
                                        disabled={rejectReason.trim().length < 10}
                                        style={{
                                            flex: 1,
                                            padding: '14px',
                                            backgroundColor: rejectReason.trim().length >= 10 ? '#DC2626' : '#FCA5A5',
                                            color: 'white',
                                            border: 'none',
                                            borderRadius: '12px',
                                            fontSize: '14px',
                                            fontWeight: 600,
                                            cursor: rejectReason.trim().length >= 10 ? 'pointer' : 'not-allowed',
                                            display: 'flex',
                                            alignItems: 'center',
                                            justifyContent: 'center',
                                            gap: '8px',
                                            transition: 'all 0.2s',
                                        }}
                                    >
                                        <X style={{ width: '16px', height: '16px' }} /> Reject
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </DashboardLayout>
    );
}

// Components
function Card({ title, icon: Icon, iconColor, iconBg, badge, children }: { title: string; icon: React.ElementType; iconColor: string; iconBg: string; badge?: React.ReactNode; children: React.ReactNode }) {
    // Map Tailwind color classes to actual CSS colors
    const iconBgColors: Record<string, string> = {
        'bg-blue-50': '#EFF6FF',
        'bg-green-50': '#F0FDF4',
        'bg-amber-50': '#FFFBEB',
        'bg-purple-50': '#FAF5FF',
        'bg-indigo-50': '#EEF2FF',
        'bg-orange-50': '#FFF7ED',
        'bg-teal-50': '#F0FDFA',
    };
    const iconTextColors: Record<string, string> = {
        'text-blue-600': '#2563EB',
        'text-green-600': '#16A34A',
        'text-amber-600': '#D97706',
        'text-purple-600': '#9333EA',
        'text-indigo-600': '#4F46E5',
        'text-orange-600': '#EA580C',
        'text-teal-600': '#0D9488',
    };

    return (
        <div style={{
            backgroundColor: 'white',
            borderRadius: '16px',
            border: '1px solid #E5E7EB',
        }}>
            <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid #E5E7EB',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
            }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                        padding: '10px',
                        backgroundColor: iconBgColors[iconBg] || '#EFF6FF',
                        borderRadius: '10px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                    }}>
                        <Icon style={{ width: '20px', height: '20px', color: iconTextColors[iconColor] || '#2563EB' }} />
                    </div>
                    <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>{title}</h3>
                </div>
                {badge}
            </div>
            <div style={{ padding: '24px' }}>{children}</div>
        </div>
    );
}

function Field({ label, value, editing, onChange, type = 'text', options = [], optionLabels = {}, optionObjects = [] }: { label: string; value: string | undefined | null; editing: boolean; onChange?: (v: string) => void; type?: 'text' | 'date' | 'number' | 'select'; options?: string[]; optionLabels?: { [key: string]: string }; optionObjects?: { name: string; flag?: string }[] }) {
    const labelStyle = { display: 'block', fontSize: '12px', fontWeight: 600, color: '#6B7280', marginBottom: '8px', textTransform: 'uppercase' as const };
    const inputStyle = {
        width: '100%',
        padding: '12px 16px',
        backgroundColor: '#F9FAFB',
        border: '1px solid #E5E7EB',
        borderRadius: '10px',
        fontSize: '14px',
        outline: 'none',
    };

    if (editing && onChange) {
        if (type === 'select') {
            // Use optionObjects if provided (for flags support)
            if (optionObjects.length > 0) {
                return (
                    <div>
                        <label style={labelStyle}>{label}</label>
                        <select value={value || ''} onChange={e => onChange(e.target.value)} style={inputStyle}>
                            <option value="">Select...</option>
                            {optionObjects.map(o => (
                                <option key={o.name} value={o.name}>{o.flag ? `${o.flag} ${o.name}` : o.name}</option>
                            ))}
                        </select>
                    </div>
                );
            }

            return (
                <div>
                    <label style={labelStyle}>{label}</label>
                    <select value={value || ''} onChange={e => onChange(e.target.value)} style={inputStyle}>
                        <option value="">Select...</option>
                        {options.map(o => <option key={o} value={o}>{optionLabels[o] || o}</option>)}
                    </select>
                </div>
            );
        }
        return (
            <div>
                <label style={labelStyle}>{label}</label>
                <input type={type} value={value || ''} onChange={e => onChange(e.target.value)} style={inputStyle} />
            </div>
        );
    }

    // Display mode - show flag for nationality if optionObjects are provided
    // Format dates as DD/MM/YYYY
    let displayValue = value || '—';
    if (type === 'date' && value) {
        const d = new Date(value);
        if (!isNaN(d.getTime())) {
            displayValue = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}/${d.getFullYear()}`;
        }
    }
    const flagObj = optionObjects.find(o => o.name === value);
    const displayWithFlag = flagObj?.flag ? `${flagObj.flag} ${displayValue}` : displayValue;

    return (
        <div style={{ padding: '4px 0' }}>
            <p style={{ fontSize: '12px', fontWeight: 500, color: '#9CA3AF', textTransform: 'uppercase', marginBottom: '4px', margin: 0 }}>{label}</p>
            <p style={{ fontSize: '14px', fontWeight: 500, color: '#111827', margin: 0 }}>{optionObjects.length > 0 ? displayWithFlag : displayValue}</p>
        </div>
    );
}

function TimelineRow({ label, date }: { label: string; date: string | null | undefined }) {
    const fmt = date ? new Date(date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
    return (
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}>
            <span style={{ fontSize: '14px', color: '#6B7280' }}>{label}</span>
            <span style={{ fontSize: '14px', fontWeight: 500, color: '#111827' }}>{fmt}</span>
        </div>
    );
}

function DocSlot({ title, url, field, accept, type = 'image', editing, uploading, onUpload, onDelete }: {
    title: string; url: string | null; field: string; accept: string; type?: 'image' | 'pdf'; editing: boolean; uploading: boolean;
    onUpload: (f: string, file: File) => void; onDelete: (f: string) => void;
}) {
    const ref = useRef<HTMLInputElement>(null);

    // When file exists - show preview with hover overlay
    if (url) {
        return (
            <div className="relative group">
                <div className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-2">
                    <FileText className="w-4 h-4 text-[#1E3A5F]" />
                    {title}
                </div>
                <div className="relative rounded-xl border-2 border-gray-200 overflow-hidden bg-gray-50">
                    {type === 'image' ? (
                        <div className="aspect-[3/2]"><img src={url} alt={title} className="w-full h-full object-cover" /></div>
                    ) : (
                        <div className="aspect-[3/2] flex flex-col items-center justify-center">
                            <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center mb-2">
                                <FileText className="w-6 h-6 text-red-500" />
                            </div>
                            <span className="text-sm text-gray-500">PDF Document</span>
                        </div>
                    )}
                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/50 transition-all flex items-center justify-center gap-3 opacity-0 group-hover:opacity-100">
                        <a href={url} target="_blank" rel="noopener noreferrer" className="w-11 h-11 bg-white rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                            <Eye className="w-5 h-5 text-gray-700" />
                        </a>
                        {editing && (
                            <button onClick={() => onDelete(field)} className="w-11 h-11 bg-red-500 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform">
                                <Trash2 className="w-5 h-5 text-white" />
                            </button>
                        )}
                    </div>
                </div>
            </div>
        );
    }

    // Upload slot - clean design with proper padding
    return (
        <div>
            <div className="text-xs font-medium text-gray-500 mb-3 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#1E3A5F]" />
                {title}
            </div>
            <div
                onClick={() => editing && ref.current?.click()}
                className={`aspect-[4/3] rounded-2xl flex flex-col items-center justify-center p-6 transition-all ${editing
                    ? 'bg-gradient-to-b from-gray-50 to-gray-100 hover:from-blue-50 hover:to-blue-100 cursor-pointer shadow-sm'
                    : 'bg-gray-50'
                    }`}
            >
                <input
                    ref={ref}
                    type="file"
                    accept={accept}
                    className="hidden"
                    onChange={e => { const f = e.target.files?.[0]; if (f) onUpload(field, f); }}
                />
                {uploading ? (
                    <div className="w-10 h-10 border-3 border-[#1E3A5F] border-t-transparent rounded-full animate-spin" />
                ) : (
                    <>
                        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 shadow-sm ${editing ? 'bg-[#1E3A5F]' : 'bg-gray-200'
                            }`}>
                            <Upload className={`w-7 h-7 ${editing ? 'text-white' : 'text-gray-400'}`} />
                        </div>
                        <p className={`text-sm font-semibold mb-1 ${editing ? 'text-gray-800' : 'text-gray-400'}`}>
                            Tap to upload
                        </p>
                        <p className="text-xs text-gray-400">
                            {type === 'pdf' ? 'PDF or Image' : 'Camera or Gallery'}
                        </p>
                    </>
                )}
            </div>
        </div>
    );
}
