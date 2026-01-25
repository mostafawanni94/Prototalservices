'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { DashboardLayout } from '@/components/layout/dashboard';
import { Button } from '@/components/ui';
import { Customer } from '@/lib/api';
import { Building2, ArrowLeft, MapPin, Save, Trash2, CreditCard, AlertTriangle, Camera, UserCircle, Plus, X, Phone, Mail, Edit2, Check, PhoneCall, Briefcase, Euro, CheckCircle, Percent, FileText, Upload, Eye, Gift } from 'lucide-react';

interface Contact {
    id?: string;
    contact_type: 'phone' | 'email' | 'mobile';
    value: string;
    label: string;
    is_primary: boolean;
}

interface Manager {
    first_name: string;
    last_name: string;
    contacts: Contact[];
}

interface Outfolder {
    id?: string;
    first_name: string;
    last_name: string;
    company_name: string;
    notes: string;
    is_active: boolean;
    contacts: Contact[];
}

interface SurchargeType {
    id: number;
    name: string;
    category: string;
    is_active: boolean;
}

interface CustomerSurcharge {
    surcharge_type: number;
    surcharge_type_name?: string;
    percentage: number;
    is_enabled: boolean;
}

interface ContractHistory {
    id: number;
    contract_document: string;
    contract_document_url: string;
    effective_from: string;
    effective_to: string | null;
    notes: string;
    uploaded_by_name: string | null;
    service_rates_snapshot: Array<{ service_id: number; service_name: string; price: string }>;
}

interface ServiceRateHistory {
    id: number;
    service: number;
    service_name: string;
    price: string;
    effective_from: string;
    effective_to: string | null;
    changed_by_name: string | null;
}

export default function CustomerDetailPage() {
    const params = useParams();
    const router = useRouter();
    const [customer, setCustomer] = useState<Customer | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const [editForm, setEditForm] = useState({
        company_name: '',
        city: '',
        postcode: '',
        address: '',
        street_name: '',
        house_number: '',
        house_number_addition: '',
        country: '',
        website: '',
        iban: '',
        btw_number: '',
        kvk_number: '',
        g_rekening: '',
        is_active: true,
    });
    const [logo, setLogo] = useState<File | null>(null);
    const [logoPreview, setLogoPreview] = useState<string | null>(null);

    // Customer contacts
    const [customerContacts, setCustomerContacts] = useState<Contact[]>([]);
    const [newCustomerContacts, setNewCustomerContacts] = useState<Contact[]>([]);
    const [hrEmail, setHrEmail] = useState<string>('');  // HR email with label 'hr'
    const [existingHrContactId, setExistingHrContactId] = useState<string | null>(null);


    // General Manager
    const [manager, setManager] = useState<Manager>({
        first_name: '',
        last_name: '',
        contacts: [],
    });
    const [newManagerContacts, setNewManagerContacts] = useState<Contact[]>([]);

    // Outfolders (supervisors)
    const [outfolders, setOutfolders] = useState<Outfolder[]>([]);
    const [showAddOutfolder, setShowAddOutfolder] = useState(false);
    const [editingOutfolderId, setEditingOutfolderId] = useState<string | null>(null);
    const [newOutfolder, setNewOutfolder] = useState<Outfolder>({
        first_name: '',
        last_name: '',
        company_name: '',
        notes: '',
        is_active: true,
        contacts: [{ contact_type: 'phone', value: '', label: '', is_primary: false }],
    });

    // Surcharge Types (shared list)
    const [surchargeTypes, setSurchargeTypes] = useState<SurchargeType[]>([]);

    // Services Surcharges
    const [hasServiceSurcharges, setHasServiceSurcharges] = useState<boolean>(false);
    const [selectedServiceSurcharges, setSelectedServiceSurcharges] = useState<CustomerSurcharge[]>([]);

    // Allowances Surcharges  
    const [hasAllowanceSurcharges, setHasAllowanceSurcharges] = useState<boolean>(false);
    const [selectedAllowanceSurcharges, setSelectedAllowanceSurcharges] = useState<CustomerSurcharge[]>([]);

    // Legacy - keep for backward compatibility (combines both)
    const [hasSurcharges, setHasSurcharges] = useState<boolean>(false);
    const [selectedSurcharges, setSelectedSurcharges] = useState<CustomerSurcharge[]>([]);

    // Services Configuration
    const [availableServices, setAvailableServices] = useState<{ id: number; name: string; code: string; description: string; is_active: boolean }[]>([]);
    const [serviceRates, setServiceRates] = useState<{ service_id: number; service_name: string; price: number; is_active: boolean }[]>([]);
    const [originalServiceRates, setOriginalServiceRates] = useState<{ service_id: number; price: number }[]>([]); // Track original for change detection

    // Allowances Configuration (custom per customer)
    const [availableAllowances, setAvailableAllowances] = useState<{ id: number; name: string; code: string; base_price: string; is_active: boolean }[]>([]);
    const [customerAllowances, setCustomerAllowances] = useState<{
        id?: number;
        allowance_type?: number;
        allowance_type_name?: string;
        allowance_type_code?: string;
        custom_name: string;
        custom_code?: string;
        custom_price?: number;
        price: number;
        is_enabled: boolean;
        apply_surcharges: boolean;
        enabled_surcharges_ids?: number[];
    }[]>([]);

    // Contract History
    const [contractHistory, setContractHistory] = useState<ContractHistory[]>([]);
    const [showContractUploadModal, setShowContractUploadModal] = useState(false);
    const [newContractFile, setNewContractFile] = useState<File | null>(null);
    const [newContractRate, setNewContractRate] = useState<string>('');
    const [newContractEffectiveFrom, setNewContractEffectiveFrom] = useState<string>('');
    const [uploadingContract, setUploadingContract] = useState(false);
    const [pendingSave, setPendingSave] = useState(false); // Flag for pending save after contract upload

    const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';


    useEffect(() => {
        loadCustomer();
        loadSurchargeTypes();
        loadServices();
        loadAllowanceTypes();
    }, [params.id]);


    async function loadSurchargeTypes() {
        try {
            const response = await fetch(`${API_URL}/employees/surcharge-types/`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
            });
            if (response.ok) {
                const data = await response.json();
                setSurchargeTypes(data.results || data);
            }
        } catch (err) {
            console.error('Failed to load surcharge types', err);
        }
    }

    async function loadServices() {
        try {
            const response = await fetch(`${API_URL}/customers/services/`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
            });
            if (response.ok) {
                const data = await response.json();
                setAvailableServices(data.results || data);
            }
        } catch (err) {
            console.error('Failed to load services', err);
        }
    }

    async function loadAllowanceTypes() {
        try {
            const response = await fetch(`${API_URL}/employees/allowance-types/`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
            });
            if (response.ok) {
                const data = await response.json();
                setAvailableAllowances(data.results || data);
            }
        } catch (err) {
            console.error('Failed to load allowance types', err);
        }
    }

    async function loadContractHistory() {
        try {
            const response = await fetch(`${API_URL}/customers/customers/${params.id}/contract_history/`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
            });
            if (response.ok) {
                const data = await response.json();
                setContractHistory(data);
            }
        } catch (err) {
            console.error('Failed to load contract history', err);
        }
    }

    async function handleUploadContract() {
        if (!newContractFile) {
            alert('Please select a contract document');
            return;
        }

        setUploadingContract(true);
        try {
            const formData = new FormData();
            formData.append('contract_document', newContractFile);
            formData.append('effective_from', newContractEffectiveFrom || new Date().toISOString().split('T')[0]);


            const response = await fetch(`${API_URL}/customers/customers/${params.id}/upload_contract/`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
                body: formData,
            });

            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.error || 'Upload failed');
            }

            // Reload contract history
            await loadContractHistory();

            // Reset modal state
            setShowContractUploadModal(false);
            setNewContractFile(null);
            setNewContractRate('');
            setNewContractEffectiveFrom('');

            // If this was triggered by rate change, continue with the save
            if (pendingSave) {
                setPendingSave(false);
                handleSave(); // Continue saving the customer data
            }
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to upload contract');
            setPendingSave(false);
        } finally {
            setUploadingContract(false);
        }
    }

    async function loadCustomer() {
        setLoading(true);
        try {
            const response = await fetch(`${API_URL}/customers/customers/${params.id}/`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
            });
            if (!response.ok) throw new Error('Customer not found');
            const data = await response.json();
            setCustomer(data);
            setEditForm({
                company_name: data.company_name || '',
                city: data.city || '',
                postcode: data.postcode || '',
                address: data.address || '',
                street_name: data.street_name || '',
                house_number: data.house_number || '',
                house_number_addition: data.house_number_addition || '',
                country: data.country || 'Netherlands',
                website: data.website || '',
                iban: data.iban || '',
                btw_number: data.btw_number || '',
                kvk_number: data.kvk_number || '',
                g_rekening: data.g_rekening || '',
                is_active: data.is_active ?? true,
            });

            // Billing Configuration (legacy/general)
            setHasSurcharges(data.has_surcharges || false);
            if (data.surcharges && Array.isArray(data.surcharges)) {
                setSelectedSurcharges(data.surcharges.map((s: any) => ({
                    surcharge_type: s.surcharge_type,
                    surcharge_type_name: s.surcharge_type_name,
                    percentage: parseFloat(s.percentage) || 25,
                    is_enabled: s.is_enabled,
                })));
            }

            // Service Surcharges
            setHasServiceSurcharges(data.has_service_surcharges || false);
            if (data.service_surcharges && Array.isArray(data.service_surcharges)) {
                setSelectedServiceSurcharges(data.service_surcharges.map((s: any) => ({
                    surcharge_type: s.surcharge_type,
                    surcharge_type_name: s.surcharge_type_name,
                    percentage: parseFloat(s.percentage) || 25,
                    is_enabled: s.is_enabled,
                })));
            }

            // Allowance Surcharges
            setHasAllowanceSurcharges(data.has_allowance_surcharges || false);
            if (data.allowance_surcharges && Array.isArray(data.allowance_surcharges)) {
                setSelectedAllowanceSurcharges(data.allowance_surcharges.map((s: any) => ({
                    surcharge_type: s.surcharge_type,
                    surcharge_type_name: s.surcharge_type_name,
                    percentage: parseFloat(s.percentage) || 25,
                    is_enabled: s.is_enabled,
                })));
            }

            // Service Rates
            if (data.service_rates && Array.isArray(data.service_rates)) {
                const rates = data.service_rates.map((sr: any) => ({
                    service_id: sr.service,
                    service_name: sr.service_name,
                    price: parseFloat(sr.price) || 0,
                    is_active: sr.is_active
                }));
                setServiceRates(rates);
                // Store original for change detection
                setOriginalServiceRates(rates.filter((r: any) => r.is_active).map((r: any) => ({ service_id: r.service_id, price: r.price })));
            }

            // Allowances
            if (data.allowances && Array.isArray(data.allowances)) {
                setCustomerAllowances(data.allowances.map((a: any) => ({
                    id: a.id,
                    allowance_type: a.allowance_type,
                    allowance_type_name: a.allowance_type_name,
                    custom_name: a.custom_name || a.allowance_type_name || '',
                    price: parseFloat(a.price) || 0,
                    is_enabled: a.is_enabled ?? true,
                    apply_surcharges: a.apply_surcharges ?? false,
                })));
            }

            // Load customer contacts (company contacts - not manager, not hr)
            if (data.contacts && Array.isArray(data.contacts)) {
                const companyContacts = data.contacts.filter((c: Contact) => c.label !== 'manager' && c.label?.toLowerCase() !== 'hr');
                const managerContacts = data.contacts.filter((c: Contact) => c.label === 'manager');
                const hrContact = data.contacts.find((c: Contact) => c.label?.toLowerCase() === 'hr' && c.contact_type === 'email');
                setCustomerContacts(companyContacts);
                setManager({
                    first_name: data.manager_first_name || '',
                    last_name: data.manager_last_name || '',
                    contacts: managerContacts,
                });
                // Set HR email if found
                if (hrContact) {
                    setHrEmail(hrContact.value || '');
                    setExistingHrContactId(hrContact.id || null);
                } else {
                    setHrEmail('');
                    setExistingHrContactId(null);
                }
            } else {
                setCustomerContacts([]);
                setManager({ first_name: data.manager_first_name || '', last_name: data.manager_last_name || '', contacts: [] });
                setHrEmail('');
                setExistingHrContactId(null);
            }
            setNewCustomerContacts([]);
            setNewManagerContacts([]);


            // Load outfolders
            if (data.outfolders && Array.isArray(data.outfolders)) {
                setOutfolders(data.outfolders.map((o: any) => ({
                    ...o,
                    contacts: o.contacts || [],
                })));
            }

            // Load contract history
            loadContractHistory();
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    }

    // Customer contact functions
    function addCustomerContact(type: 'phone' | 'email') {
        setNewCustomerContacts([...newCustomerContacts, { contact_type: type, value: '', label: 'company', is_primary: false }]);
    }

    function removeNewCustomerContact(index: number) {
        setNewCustomerContacts(newCustomerContacts.filter((_, i) => i !== index));
    }

    function updateNewCustomerContact(index: number, value: string) {
        setNewCustomerContacts(newCustomerContacts.map((c, i) => i === index ? { ...c, value } : c));
    }

    // Manager contact functions
    function addManagerContact(type: 'phone' | 'email') {
        setNewManagerContacts([...newManagerContacts, { contact_type: type, value: '', label: 'manager', is_primary: false }]);
    }

    function removeNewManagerContact(index: number) {
        setNewManagerContacts(newManagerContacts.filter((_, i) => i !== index));
    }

    function updateNewManagerContact(index: number, value: string) {
        setNewManagerContacts(newManagerContacts.map((c, i) => i === index ? { ...c, value } : c));
    }

    // Surcharge functions (NEW)
    function toggleSurcharge(surchargeTypeId: number) {
        const existing = selectedSurcharges.find(s => s.surcharge_type === surchargeTypeId);
        if (existing?.is_enabled) {
            // Disable
            setSelectedSurcharges(selectedSurcharges.map(s =>
                s.surcharge_type === surchargeTypeId ? { ...s, is_enabled: false } : s
            ));
        } else {
            // Enable
            if (existing) {
                setSelectedSurcharges(selectedSurcharges.map(s =>
                    s.surcharge_type === surchargeTypeId ? { ...s, is_enabled: true } : s
                ));
            } else {
                const st = surchargeTypes.find(t => t.id === surchargeTypeId);
                setSelectedSurcharges([...selectedSurcharges, {
                    surcharge_type: surchargeTypeId,
                    surcharge_type_name: st?.name || '',
                    percentage: 25,
                    is_enabled: true
                }]);
            }
        }
    }

    function updateSurchargePercentage(surchargeTypeId: number, percentage: number) {
        setSelectedSurcharges(selectedSurcharges.map(s =>
            s.surcharge_type === surchargeTypeId ? { ...s, percentage } : s
        ));
    }

    // Service surcharge functions
    function toggleServiceSurcharge(surchargeTypeId: number) {
        const existing = selectedServiceSurcharges.find(s => s.surcharge_type === surchargeTypeId);
        if (existing?.is_enabled) {
            setSelectedServiceSurcharges(selectedServiceSurcharges.map(s =>
                s.surcharge_type === surchargeTypeId ? { ...s, is_enabled: false } : s
            ));
        } else {
            if (existing) {
                setSelectedServiceSurcharges(selectedServiceSurcharges.map(s =>
                    s.surcharge_type === surchargeTypeId ? { ...s, is_enabled: true } : s
                ));
            } else {
                const st = surchargeTypes.find(t => t.id === surchargeTypeId);
                setSelectedServiceSurcharges([...selectedServiceSurcharges, {
                    surcharge_type: surchargeTypeId,
                    surcharge_type_name: st?.name || '',
                    percentage: 25,
                    is_enabled: true
                }]);
            }
        }
    }

    function updateServiceSurchargePercentage(surchargeTypeId: number, percentage: number) {
        setSelectedServiceSurcharges(selectedServiceSurcharges.map(s =>
            s.surcharge_type === surchargeTypeId ? { ...s, percentage } : s
        ));
    }

    // Allowance surcharge functions
    function toggleAllowanceSurcharge(surchargeTypeId: number) {
        const existing = selectedAllowanceSurcharges.find(s => s.surcharge_type === surchargeTypeId);
        if (existing?.is_enabled) {
            setSelectedAllowanceSurcharges(selectedAllowanceSurcharges.map(s =>
                s.surcharge_type === surchargeTypeId ? { ...s, is_enabled: false } : s
            ));
        } else {
            if (existing) {
                setSelectedAllowanceSurcharges(selectedAllowanceSurcharges.map(s =>
                    s.surcharge_type === surchargeTypeId ? { ...s, is_enabled: true } : s
                ));
            } else {
                const st = surchargeTypes.find(t => t.id === surchargeTypeId);
                setSelectedAllowanceSurcharges([...selectedAllowanceSurcharges, {
                    surcharge_type: surchargeTypeId,
                    surcharge_type_name: st?.name || '',
                    percentage: 25,
                    is_enabled: true
                }]);
            }
        }
    }

    function updateAllowanceSurchargePercentage(surchargeTypeId: number, percentage: number) {
        setSelectedAllowanceSurcharges(selectedAllowanceSurcharges.map(s =>
            s.surcharge_type === surchargeTypeId ? { ...s, percentage } : s
        ));
    }

    // Surcharge rate calculation moved to invoice generation

    // Service functions
    function toggleService(serviceId: number) {
        const existing = serviceRates.find(sr => sr.service_id === serviceId);
        if (existing?.is_active) {
            // Disable
            setServiceRates(serviceRates.map(sr =>
                sr.service_id === serviceId ? { ...sr, is_active: false } : sr
            ));
        } else {
            // Enable
            if (existing) {
                setServiceRates(serviceRates.map(sr =>
                    sr.service_id === serviceId ? { ...sr, is_active: true } : sr
                ));
            } else {
                const svc = availableServices.find(s => s.id === serviceId);
                setServiceRates([...serviceRates, {
                    service_id: serviceId,
                    service_name: svc?.name || '',
                    price: 0,
                    is_active: true
                }]);
            }
        }
    }

    function updateServicePrice(serviceId: number, price: number) {
        setServiceRates(serviceRates.map(sr =>
            sr.service_id === serviceId ? { ...sr, price } : sr
        ));
    }

    // Allowance functions
    function toggleAllowance(allowanceId: number) {
        const existing = customerAllowances.find(a => a.allowance_type === allowanceId);
        if (existing?.is_enabled) {
            // Disable
            setCustomerAllowances(customerAllowances.map(a =>
                a.allowance_type === allowanceId ? { ...a, is_enabled: false } : a
            ));
        } else {
            // Enable
            if (existing) {
                setCustomerAllowances(customerAllowances.map(a =>
                    a.allowance_type === allowanceId ? { ...a, is_enabled: true } : a
                ));
            } else {
                const allowance = availableAllowances.find(at => at.id === allowanceId);
                setCustomerAllowances([...customerAllowances, {
                    allowance_type: allowanceId,
                    allowance_type_name: allowance?.name || '',
                    allowance_type_code: allowance?.code || '',
                    custom_name: allowance?.name || '',
                    custom_price: undefined,
                    price: parseFloat(allowance?.base_price || '0'),
                    is_enabled: true,
                    apply_surcharges: true,
                    enabled_surcharges_ids: []
                }]);
            }
        }
    }

    function updateAllowanceCustomPrice(allowanceId: number, customPrice: number | undefined) {
        setCustomerAllowances(customerAllowances.map(a =>
            a.allowance_type === allowanceId ? { ...a, custom_price: customPrice } : a
        ));
    }

    function toggleAllowanceSurcharges(allowanceId: number) {
        setCustomerAllowances(customerAllowances.map(a =>
            a.allowance_type === allowanceId ? { ...a, apply_surcharges: !a.apply_surcharges } : a
        ));
    }

    function toggleAllowanceSurchargeType(allowanceId: number, surchargeTypeId: number) {
        setCustomerAllowances(customerAllowances.map(a => {
            if (a.allowance_type === allowanceId) {
                const current = a.enabled_surcharges_ids || [];
                const newIds = current.includes(surchargeTypeId)
                    ? current.filter(id => id !== surchargeTypeId)
                    : [...current, surchargeTypeId];
                return { ...a, enabled_surcharges_ids: newIds };
            }
            return a;
        }));
    }

    // Custom Allowance functions (for customer-specific allowances)
    function addCustomAllowance() {
        setCustomerAllowances([...customerAllowances, {
            allowance_type: undefined,
            custom_name: '',
            custom_code: '',
            price: 0,
            is_enabled: true,
            apply_surcharges: false
        }]);
    }

    function updateCustomAllowance(index: number, field: string, value: string | number | boolean | undefined) {
        setCustomerAllowances(customerAllowances.map((a, i) =>
            i === index ? { ...a, [field]: value } : a
        ));
    }

    function removeCustomAllowance(index: number) {
        setCustomerAllowances(customerAllowances.filter((_, i) => i !== index));
    }

    // Outfolder contact functions
    function addOutfolderContact(type: 'phone' | 'email') {
        setNewOutfolder(s => ({
            ...s,
            contacts: [...s.contacts, { contact_type: type, value: '', label: '', is_primary: false }],
        }));
    }

    function removeOutfolderContact(index: number) {
        setNewOutfolder(s => ({ ...s, contacts: s.contacts.filter((_, i) => i !== index) }));
    }

    function updateOutfolderContact(index: number, value: string) {
        setNewOutfolder(s => ({
            ...s,
            contacts: s.contacts.map((c, i) => i === index ? { ...c, value } : c),
        }));
    }

    function startEditOutfolder(outfolder: Outfolder) {
        setEditingOutfolderId(outfolder.id || null);
        setNewOutfolder({
            ...outfolder,
            contacts: outfolder.contacts.length > 0 ? outfolder.contacts : [{ contact_type: 'phone', value: '', label: '', is_primary: false }],
        });
        setShowAddOutfolder(false);
    }

    function cancelEdit() {
        setEditingOutfolderId(null);
        setNewOutfolder({
            first_name: '',
            last_name: '',
            company_name: '',
            notes: '',
            is_active: true,
            contacts: [{ contact_type: 'phone', value: '', label: '', is_primary: false }],
        });
    }

    async function handleSaveOutfolder() {
        if (!newOutfolder.first_name.trim() || !newOutfolder.last_name.trim()) {
            alert('First name and last name are required');
            return;
        }

        try {
            if (editingOutfolderId) {
                const outfolderResponse = await fetch(`${API_URL}/customers/outfolders/${editingOutfolderId}/`, {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                    },
                    body: JSON.stringify({
                        first_name: newOutfolder.first_name,
                        last_name: newOutfolder.last_name,
                        company_name: newOutfolder.company_name,
                        notes: newOutfolder.notes,
                        is_active: true,
                    }),
                });

                if (!outfolderResponse.ok) {
                    throw new Error('Failed to update supervisor');
                }

                for (const contact of newOutfolder.contacts) {
                    if (contact.value.trim() && !contact.id) {
                        await fetch(`${API_URL}/customers/outfolders/${editingOutfolderId}/add_contact/`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                            },
                            body: JSON.stringify({
                                contact_type: contact.contact_type,
                                value: contact.value,
                                label: contact.label || '',
                                is_primary: contact.is_primary,
                            }),
                        });
                    }
                }

                setEditingOutfolderId(null);
                alert('Supervisor updated successfully!');
            } else {
                const outfolderResponse = await fetch(`${API_URL}/customers/outfolders/`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                    },
                    body: JSON.stringify({
                        customer: params.id,
                        first_name: newOutfolder.first_name,
                        last_name: newOutfolder.last_name,
                        company_name: newOutfolder.company_name || customer?.company_name || '',
                        notes: newOutfolder.notes,
                        is_active: true,
                    }),
                });

                if (!outfolderResponse.ok) {
                    const errorData = await outfolderResponse.json();
                    throw new Error(errorData.detail || 'Failed to create supervisor');
                }

                const createdOutfolder = await outfolderResponse.json();

                for (const contact of newOutfolder.contacts) {
                    if (contact.value.trim()) {
                        await fetch(`${API_URL}/customers/outfolders/${createdOutfolder.id}/add_contact/`, {
                            method: 'POST',
                            headers: {
                                'Content-Type': 'application/json',
                                'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                            },
                            body: JSON.stringify({
                                contact_type: contact.contact_type,
                                value: contact.value,
                                label: contact.label || '',
                                is_primary: contact.is_primary,
                            }),
                        });
                    }
                }

                setShowAddOutfolder(false);
                alert('Supervisor added successfully!');
            }

            await loadCustomer();
            setNewOutfolder({
                first_name: '',
                last_name: '',
                company_name: '',
                notes: '',
                is_active: true,
                contacts: [{ contact_type: 'phone', value: '', label: '', is_primary: false }],
            });
        } catch (err) {
            alert(err instanceof Error ? err.message : 'Failed to save supervisor');
        }
    }

    async function removeOutfolder(outfolderId: string) {
        if (!confirm('Are you sure you want to remove this supervisor?')) return;

        try {
            const response = await fetch(`${API_URL}/customers/outfolders/${outfolderId}/`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
            });
            if (!response.ok) throw new Error('Failed to delete');
            await loadCustomer();
        } catch (err) {
            alert('Failed to remove supervisor');
        }
    }

    async function handleSave() {
        // Detect if service rates have changed
        const currentActiveRates = serviceRates.filter(r => r.is_active).map(r => ({ service_id: r.service_id, price: r.price }));
        const serviceRatesChanged = JSON.stringify(currentActiveRates.sort((a, b) => a.service_id - b.service_id)) !==
            JSON.stringify(originalServiceRates.sort((a, b) => a.service_id - b.service_id));

        // If service rates changed, ask for contract upload first
        if (serviceRatesChanged && !pendingSave) {

            setPendingSave(true);
            setNewContractEffectiveFrom(new Date().toISOString().split('T')[0]);
            setShowContractUploadModal(true);
            return;
        }

        setSaving(true);
        try {

            const formData = new FormData();
            formData.append('company_name', editForm.company_name);
            formData.append('city', editForm.city);
            formData.append('postcode', editForm.postcode);
            // Build combined address for legacy field
            const combinedAddress = [editForm.street_name, editForm.house_number, editForm.house_number_addition].filter(Boolean).join(' ');
            formData.append('address', combinedAddress || editForm.address);
            formData.append('street_name', editForm.street_name);
            formData.append('house_number', editForm.house_number);
            formData.append('house_number_addition', editForm.house_number_addition);
            formData.append('country', editForm.country || 'Netherlands');
            if (editForm.website) {
                // Auto-format website: add https://www. if needed
                let website = editForm.website.trim().toLowerCase();
                // Remove any existing protocol
                website = website.replace(/^https?:\/\//i, '');
                // Add www. if not present
                if (!website.startsWith('www.')) {
                    website = 'www.' + website;
                }
                // Add https://
                website = 'https://' + website;
                formData.append('website', website);
            }
            formData.append('is_active', String(editForm.is_active));
            // Manager name
            if (manager.first_name) formData.append('manager_first_name', manager.first_name);
            if (manager.last_name) formData.append('manager_last_name', manager.last_name);
            if (editForm.iban) formData.append('iban', editForm.iban);
            if (editForm.btw_number) formData.append('btw_number', editForm.btw_number);
            if (editForm.kvk_number) formData.append('kvk_number', editForm.kvk_number);
            if (editForm.g_rekening) formData.append('g_rekening', editForm.g_rekening);
            if (logo) formData.append('logo', logo);

            const response = await fetch(`${API_URL}/customers/customers/${params.id}/`, {
                method: 'PATCH',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
                body: formData,
            });
            if (!response.ok) throw new Error('Failed to save');

            // Save Billing Configuration (separate JSON call for nested data)
            const billingPayload = {
                has_surcharges: hasSurcharges,
                surcharges: selectedSurcharges.filter(s => s.is_enabled).map(s => ({
                    surcharge_type: s.surcharge_type,
                    percentage: s.percentage,
                    is_enabled: s.is_enabled
                })),
                // Service-specific surcharges
                has_service_surcharges: hasServiceSurcharges,
                service_surcharges: selectedServiceSurcharges.filter(s => s.is_enabled).map(s => ({
                    surcharge_type: s.surcharge_type,
                    percentage: s.percentage,
                    is_enabled: s.is_enabled
                })),
                // Allowance-specific surcharges
                has_allowance_surcharges: hasAllowanceSurcharges,
                allowance_surcharges: selectedAllowanceSurcharges.filter(s => s.is_enabled).map(s => ({
                    surcharge_type: s.surcharge_type,
                    percentage: s.percentage,
                    is_enabled: s.is_enabled
                })),
                service_rates: serviceRates.filter(sr => sr.is_active).map(sr => ({
                    service_id: sr.service_id,
                    price: sr.price,
                    is_active: true
                })),
                allowances: customerAllowances.filter(a => a.custom_name?.trim() || a.allowance_type).map(a => ({
                    id: a.id,
                    allowance_type: a.allowance_type || null,
                    custom_name: a.custom_name,
                    custom_code: a.custom_code || '',
                    price: a.price,
                    is_enabled: a.is_enabled,
                    apply_surcharges: a.apply_surcharges,
                }))
            };

            await fetch(`${API_URL}/customers/customers/${params.id}/`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('access_token')}`
                },
                body: JSON.stringify(billingPayload),
            });

            // Add new customer contacts
            for (const contact of newCustomerContacts) {
                if (contact.value.trim()) {
                    await fetch(`${API_URL}/customers/customers/${params.id}/add_contact/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                        },
                        body: JSON.stringify({
                            contact_type: contact.contact_type,
                            value: contact.value,
                            label: 'company',
                            is_primary: contact.is_primary,
                        }),
                    });
                }
            }

            // Add new manager contacts
            for (const contact of newManagerContacts) {
                if (contact.value.trim()) {
                    await fetch(`${API_URL}/customers/customers/${params.id}/add_contact/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                        },
                        body: JSON.stringify({
                            contact_type: contact.contact_type,
                            value: contact.value,
                            label: 'manager',
                            is_primary: contact.is_primary,
                        }),
                    });
                }
            }

            // Save HR email (update or create)
            if (hrEmail.trim()) {
                if (existingHrContactId) {
                    // Update existing HR contact
                    await fetch(`${API_URL}/customers/contacts/${existingHrContactId}/`, {
                        method: 'PATCH',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                        },
                        body: JSON.stringify({ value: hrEmail.trim() }),
                    });
                } else {
                    // Create new HR contact
                    await fetch(`${API_URL}/customers/customers/${params.id}/add_contact/`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${localStorage.getItem('access_token')}`,
                        },
                        body: JSON.stringify({
                            contact_type: 'email',
                            value: hrEmail.trim(),
                            label: 'hr',
                            is_primary: false,
                        }),
                    });
                }
            } else if (existingHrContactId) {
                // Delete HR contact if email was cleared
                await fetch(`${API_URL}/customers/contacts/${existingHrContactId}/`, {
                    method: 'DELETE',
                    headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
                });
            }


            setLogo(null);
            await loadCustomer();
            alert('Customer updated successfully!');
        } catch (err) {
            alert('Failed to save customer');
        } finally {
            setSaving(false);
        }
    }

    async function handleDelete() {
        setDeleting(true);
        try {
            const response = await fetch(`${API_URL}/customers/customers/${params.id}/`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${localStorage.getItem('access_token')}` },
            });
            if (!response.ok) throw new Error('Failed to delete');
            router.push('/dashboard/customers');
        } catch (err) {
            alert('Failed to delete customer');
            setDeleting(false);
        }
    }

    const inputStyle = {
        width: '100%',
        padding: '12px 16px',
        backgroundColor: '#F9FAFB',
        border: '1px solid #E5E7EB',
        borderRadius: '10px',
        fontSize: '14px',
        outline: 'none',
    };

    const labelStyle = {
        display: 'block',
        fontSize: '12px',
        fontWeight: 600,
        color: '#6B7280',
        marginBottom: '8px',
        textTransform: 'uppercase' as const,
    };

    if (loading) {
        return (
            <DashboardLayout>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                    <div style={{ width: '40px', height: '40px', border: '3px solid #E5E7EB', borderTopColor: '#1E3A5F', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                </div>
            </DashboardLayout>
        );
    }

    if (!customer) {
        return (
            <DashboardLayout>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
                    <AlertTriangle style={{ width: '64px', height: '64px', color: '#EF4444', marginBottom: '16px' }} />
                    <h2 style={{ fontSize: '20px', fontWeight: 600, color: '#111827', marginBottom: '8px' }}>Customer Not Found</h2>
                    <p style={{ color: '#6B7280', marginBottom: '16px' }}>The customer you're looking for doesn't exist.</p>
                    <Button onClick={() => router.push('/dashboard/customers')} className="bg-[#1E3A5F]">Back to Customers</Button>
                </div>
            </DashboardLayout>
        );
    }

    const existingPhones = customerContacts.filter(c => c.contact_type === 'phone' || c.contact_type === 'mobile');
    const existingEmails = customerContacts.filter(c => c.contact_type === 'email');
    const newPhones = newCustomerContacts.filter(c => c.contact_type === 'phone' || c.contact_type === 'mobile');
    const newEmails = newCustomerContacts.filter(c => c.contact_type === 'email');
    const existingManagerPhones = manager.contacts.filter(c => c.contact_type === 'phone' || c.contact_type === 'mobile');
    const existingManagerEmails = manager.contacts.filter(c => c.contact_type === 'email');
    const newManagerPhones = newManagerContacts.filter(c => c.contact_type === 'phone' || c.contact_type === 'mobile');
    const newManagerEmails = newManagerContacts.filter(c => c.contact_type === 'email');
    const outfolderPhones = newOutfolder.contacts.filter(c => c.contact_type === 'phone' || c.contact_type === 'mobile');
    const outfolderEmails = newOutfolder.contacts.filter(c => c.contact_type === 'email');

    return (
        <DashboardLayout>
            <div className="max-w-4xl mx-auto px-6 py-6">
                {/* Header */}
                <div style={{ marginBottom: '24px' }}>
                    <button onClick={() => router.push('/dashboard/customers')} style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#6B7280', fontSize: '14px', fontWeight: 500, background: 'none', border: 'none', cursor: 'pointer', marginBottom: '16px' }}>
                        <ArrowLeft style={{ width: '16px', height: '16px' }} />
                        Back to Customers
                    </button>

                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                            <div style={{ position: 'relative', width: '72px', height: '72px', cursor: 'pointer' }} onClick={() => document.getElementById('customer-logo-upload')?.click()}>
                                <input id="customer-logo-upload" type="file" accept="image/*" onChange={(e) => { const file = e.target.files?.[0]; if (file) { setLogo(file); setLogoPreview(URL.createObjectURL(file)); } }} style={{ display: 'none' }} />
                                {logoPreview || (customer as any)?.logo ? (
                                    <img src={logoPreview || (customer as any)?.logo} alt="Company logo" style={{ width: '72px', height: '72px', borderRadius: '50%', objectFit: 'cover', border: '4px solid white', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }} />
                                ) : (
                                    <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: 'linear-gradient(135deg, #1E3A5F, #3E5A8F)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '4px solid white', boxShadow: '0 4px 20px rgba(0,0,0,0.1)' }}>
                                        <Building2 style={{ width: '32px', height: '32px', color: 'white' }} />
                                    </div>
                                )}
                                <div style={{ position: 'absolute', bottom: '0', right: '0', width: '28px', height: '28px', borderRadius: '50%', backgroundColor: '#1E3A5F', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid white' }}>
                                    <Camera style={{ width: '14px', height: '14px', color: 'white' }} />
                                </div>
                            </div>
                            <div>
                                <h1 style={{ fontSize: '24px', fontWeight: 700, color: '#111827', margin: 0 }}>{customer.company_name}</h1>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                                    <MapPin style={{ width: '14px', height: '14px', color: '#9CA3AF' }} />
                                    <span style={{ fontSize: '14px', color: '#6B7280' }}>{customer.city}, {customer.country}</span>
                                    <span style={{ marginLeft: '8px', padding: '4px 10px', borderRadius: '9999px', fontSize: '12px', fontWeight: 600, backgroundColor: customer.is_active ? '#DCFCE7' : '#F3F4F6', color: customer.is_active ? '#16A34A' : '#6B7280' }}>
                                        {customer.is_active ? 'Active' : 'Inactive'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div style={{ display: 'flex', gap: '12px' }}>
                            <button onClick={() => setShowDeleteConfirm(true)} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: 'white', color: '#DC2626', border: '1px solid #FCA5A5', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>
                                <Trash2 style={{ width: '16px', height: '16px' }} /> Delete
                            </button>
                            <button onClick={handleSave} disabled={saving} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', backgroundColor: '#1E3A5F', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>
                                <Save style={{ width: '16px', height: '16px' }} /> {saving ? 'Saving...' : 'Save Changes'}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Company Information Card */}
                <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E5E7EB', padding: '24px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ padding: '10px', backgroundColor: '#EFF6FF', borderRadius: '10px' }}>
                            <Building2 style={{ width: '20px', height: '20px', color: '#2563EB' }} />
                        </div>
                        <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>Company Information</h2>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div><label style={labelStyle}>Company Name</label><input type="text" value={editForm.company_name} onChange={(e) => setEditForm(f => ({ ...f, company_name: e.target.value }))} style={inputStyle} /></div>

                        {/* Street Name with Icon */}
                        <div>
                            <label style={labelStyle}>🛣️ Street Name</label>
                            <input
                                type="text"
                                value={editForm.street_name}
                                onChange={(e) => setEditForm(f => ({ ...f, street_name: e.target.value }))}
                                placeholder="Kerkstraat"
                                style={inputStyle}
                            />
                        </div>

                        {/* House Number and Addition Row */}
                        <div style={{ display: 'flex', gap: '12px' }}>
                            <div style={{ flex: 1 }}>
                                <label style={labelStyle}>🏠 House Nr.</label>
                                <input
                                    type="text"
                                    value={editForm.house_number}
                                    onChange={(e) => setEditForm(f => ({ ...f, house_number: e.target.value }))}
                                    placeholder="123"
                                    style={inputStyle}
                                />
                            </div>
                            <div style={{ width: '100px' }}>
                                <label style={labelStyle}>➕ Add.</label>
                                <input
                                    type="text"
                                    value={editForm.house_number_addition}
                                    onChange={(e) => setEditForm(f => ({ ...f, house_number_addition: e.target.value.toUpperCase() }))}
                                    placeholder="A"
                                    style={{ ...inputStyle, textTransform: 'uppercase' }}
                                />
                            </div>
                        </div>

                        <div><label style={labelStyle}>City</label><input type="text" value={editForm.city} onChange={(e) => setEditForm(f => ({ ...f, city: e.target.value }))} style={inputStyle} /></div>
                        <div><label style={labelStyle}>Postcode</label><input type="text" value={editForm.postcode} onChange={(e) => setEditForm(f => ({ ...f, postcode: e.target.value.toUpperCase() }))} style={{ ...inputStyle, textTransform: 'uppercase' }} /></div>

                        {/* Website with Link Icon */}
                        <div>
                            <label style={labelStyle}>🔗 Website</label>
                            <input
                                type="url"
                                value={editForm.website}
                                onChange={(e) => setEditForm(f => ({ ...f, website: e.target.value }))}
                                placeholder="https://www.example.com"
                                style={inputStyle}
                            />
                        </div>
                    </div>

                    {/* Contact Information Section - integrated into Company Information */}
                    <div style={{ marginTop: '24px', paddingTop: '24px', borderTop: '1px solid #E5E7EB' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '20px' }}>
                            <div style={{ padding: '8px', backgroundColor: '#FEF3C7', borderRadius: '8px' }}>
                                <PhoneCall style={{ width: '16px', height: '16px', color: '#D97706' }} />
                            </div>
                            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#374151', margin: 0 }}>Contact Information</h3>
                        </div>

                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                            {/* Phone Numbers */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <label style={{ ...labelStyle, marginBottom: 0 }}>Phone Numbers</label>
                                    <button onClick={() => addCustomerContact('phone')} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', backgroundColor: '#EFF6FF', color: '#2563EB', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                                        <Plus style={{ width: '12px', height: '12px' }} /> Add
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {existingPhones.map((contact, idx) => (
                                        <div key={`existing-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', backgroundColor: '#F9FAFB', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
                                            <Phone style={{ width: '14px', height: '14px', color: '#6B7280' }} />
                                            <span style={{ fontSize: '14px', color: '#374151' }}>{contact.value}</span>
                                        </div>
                                    ))}
                                    {newCustomerContacts.map((contact, idx) => contact.contact_type === 'phone' || contact.contact_type === 'mobile' ? (
                                        <div key={`new-${idx}`} style={{ display: 'flex', gap: '8px' }}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <Phone style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#9CA3AF' }} />
                                                <input type="tel" value={contact.value} onChange={(e) => updateNewCustomerContact(idx, e.target.value)} placeholder="+31 6 12345678" style={{ ...inputStyle, paddingLeft: '36px' }} />
                                            </div>
                                            <button onClick={() => removeNewCustomerContact(idx)} style={{ padding: '10px', backgroundColor: '#FEE2E2', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#DC2626' }}>
                                                <X style={{ width: '14px', height: '14px' }} />
                                            </button>
                                        </div>
                                    ) : null)}
                                    {existingPhones.length === 0 && newPhones.length === 0 && (
                                        <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>No phone numbers. Click "Add" to add one.</p>
                                    )}
                                </div>
                            </div>

                            {/* Email Addresses */}
                            <div>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <label style={{ ...labelStyle, marginBottom: 0 }}>Email Addresses</label>
                                    <button onClick={() => addCustomerContact('email')} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', backgroundColor: '#EFF6FF', color: '#2563EB', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                                        <Plus style={{ width: '12px', height: '12px' }} /> Add
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {existingEmails.map((contact, idx) => (
                                        <div key={`existing-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', backgroundColor: '#F9FAFB', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
                                            <Mail style={{ width: '14px', height: '14px', color: '#6B7280' }} />
                                            <span style={{ fontSize: '14px', color: '#374151' }}>{contact.value}</span>
                                        </div>
                                    ))}
                                    {newCustomerContacts.map((contact, idx) => contact.contact_type === 'email' ? (
                                        <div key={`new-${idx}`} style={{ display: 'flex', gap: '8px' }}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <Mail style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#9CA3AF' }} />
                                                <input type="email" value={contact.value} onChange={(e) => updateNewCustomerContact(idx, e.target.value)} placeholder="info@company.com" style={{ ...inputStyle, paddingLeft: '36px' }} />
                                            </div>
                                            <button onClick={() => removeNewCustomerContact(idx)} style={{ padding: '10px', backgroundColor: '#FEE2E2', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#DC2626' }}>
                                                <X style={{ width: '14px', height: '14px' }} />
                                            </button>
                                        </div>
                                    ) : null)}
                                    {existingEmails.length === 0 && newEmails.length === 0 && (
                                        <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>No email addresses. Click "Add" to add one.</p>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* HR Email - Special field */}
                        <div style={{ marginTop: '16px', padding: '16px', backgroundColor: '#F0FDF4', borderRadius: '12px', border: '1px solid #86EFAC' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                                <Mail style={{ width: '16px', height: '16px', color: '#16A34A' }} />
                                <label style={{ ...labelStyle, marginBottom: 0, color: '#16A34A' }}>HR Email (for Reports)</label>
                            </div>
                            <input
                                type="email"
                                value={hrEmail}
                                onChange={(e) => setHrEmail(e.target.value)}
                                placeholder="hr@company.com"
                                style={{ ...inputStyle, backgroundColor: 'white', borderColor: '#86EFAC' }}
                            />
                            <p style={{ fontSize: '11px', color: '#6B7280', margin: '6px 0 0' }}>This email will appear on HR export reports</p>
                        </div>
                    </div>


                    <div style={{ marginTop: '20px', paddingTop: '20px', borderTop: '1px solid #E5E7EB' }}>
                        <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}>
                            <input type="checkbox" checked={editForm.is_active} onChange={(e) => setEditForm(f => ({ ...f, is_active: e.target.checked }))} style={{ width: '20px', height: '20px' }} />
                            <span style={{ fontSize: '14px', fontWeight: 500, color: '#374151' }}>Active Customer</span>
                        </label>
                    </div>
                </div>
                {/* General Manager Card */}
                <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E5E7EB', padding: '24px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ padding: '10px', backgroundColor: '#DCFCE7', borderRadius: '10px' }}>
                            <Briefcase style={{ width: '20px', height: '20px', color: '#16A34A' }} />
                        </div>
                        <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>General Manager</h2>
                    </div>

                    {/* Manager Name */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '20px' }}>
                        <div><label style={labelStyle}>First Name</label><input type="text" value={manager.first_name} onChange={(e) => setManager(m => ({ ...m, first_name: e.target.value }))} placeholder="John" style={inputStyle} /></div>
                        <div><label style={labelStyle}>Last Name</label><input type="text" value={manager.last_name} onChange={(e) => setManager(m => ({ ...m, last_name: e.target.value }))} placeholder="Doe" style={inputStyle} /></div>
                    </div>

                    {/* Manager Phone Numbers */}
                    <div style={{ marginBottom: '20px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <label style={{ ...labelStyle, marginBottom: 0 }}>Phone Numbers</label>
                            <button onClick={() => addManagerContact('phone')} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', backgroundColor: '#EFF6FF', color: '#2563EB', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                                <Plus style={{ width: '12px', height: '12px' }} /> Add
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {existingManagerPhones.map((contact, idx) => (
                                <div key={`existing-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', backgroundColor: '#F9FAFB', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
                                    <Phone style={{ width: '14px', height: '14px', color: '#6B7280' }} />
                                    <span style={{ fontSize: '14px', color: '#374151' }}>{contact.value}</span>
                                </div>
                            ))}
                            {newManagerContacts.map((contact, idx) => contact.contact_type === 'phone' || contact.contact_type === 'mobile' ? (
                                <div key={`new-${idx}`} style={{ display: 'flex', gap: '8px' }}>
                                    <div style={{ position: 'relative', flex: 1 }}>
                                        <Phone style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#9CA3AF' }} />
                                        <input type="tel" value={contact.value} onChange={(e) => updateNewManagerContact(idx, e.target.value)} placeholder="+31 6 12345678" style={{ ...inputStyle, paddingLeft: '36px' }} />
                                    </div>
                                    <button onClick={() => removeNewManagerContact(idx)} style={{ padding: '10px', backgroundColor: '#FEE2E2', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#DC2626' }}>
                                        <X style={{ width: '14px', height: '14px' }} />
                                    </button>
                                </div>
                            ) : null)}
                            {existingManagerPhones.length === 0 && newManagerPhones.length === 0 && (
                                <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>No phone numbers. Click "Add" to add one.</p>
                            )}
                        </div>
                    </div>

                    {/* Manager Email Addresses */}
                    <div>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                            <label style={{ ...labelStyle, marginBottom: 0 }}>Email Addresses</label>
                            <button onClick={() => addManagerContact('email')} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', backgroundColor: '#EFF6FF', color: '#2563EB', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                                <Plus style={{ width: '12px', height: '12px' }} /> Add
                            </button>
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {existingManagerEmails.map((contact, idx) => (
                                <div key={`existing-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', backgroundColor: '#F9FAFB', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
                                    <Mail style={{ width: '14px', height: '14px', color: '#6B7280' }} />
                                    <span style={{ fontSize: '14px', color: '#374151' }}>{contact.value}</span>
                                </div>
                            ))}
                            {newManagerContacts.map((contact, idx) => contact.contact_type === 'email' ? (
                                <div key={`new-${idx}`} style={{ display: 'flex', gap: '8px' }}>
                                    <div style={{ position: 'relative', flex: 1 }}>
                                        <Mail style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#9CA3AF' }} />
                                        <input type="email" value={contact.value} onChange={(e) => updateNewManagerContact(idx, e.target.value)} placeholder="manager@company.com" style={{ ...inputStyle, paddingLeft: '36px' }} />
                                    </div>
                                    <button onClick={() => removeNewManagerContact(idx)} style={{ padding: '10px', backgroundColor: '#FEE2E2', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#DC2626' }}>
                                        <X style={{ width: '14px', height: '14px' }} />
                                    </button>
                                </div>
                            ) : null)}
                            {existingManagerEmails.length === 0 && newManagerEmails.length === 0 && (
                                <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>No email addresses. Click "Add" to add one.</p>
                            )}
                        </div>
                    </div>
                </div>


                {/* Supervisors Section */}
                <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E5E7EB', padding: '24px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ padding: '10px', backgroundColor: '#F3E8FF', borderRadius: '10px' }}>
                                <UserCircle style={{ width: '20px', height: '20px', color: '#9333EA' }} />
                            </div>
                            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>Supervisors</h2>
                            <span style={{ fontSize: '13px', color: '#9CA3AF' }}>({outfolders.length})</span>
                        </div>
                        {!showAddOutfolder && !editingOutfolderId && (
                            <button onClick={() => setShowAddOutfolder(true)} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 16px', backgroundColor: '#1E3A5F', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                                <Plus style={{ width: '14px', height: '14px' }} /> Add Supervisor
                            </button>
                        )}
                    </div>

                    {/* Existing Supervisors List */}
                    {outfolders.length > 0 && !editingOutfolderId && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginBottom: showAddOutfolder ? '24px' : '0' }}>
                            {outfolders.map((outfolder, idx) => (
                                <div key={outfolder.id || idx} style={{ padding: '16px', backgroundColor: '#F9FAFB', borderRadius: '12px', border: '1px solid #E5E7EB' }}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                        <div style={{ flex: 1 }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <p style={{ fontSize: '16px', fontWeight: 600, color: '#111827', margin: 0 }}>{outfolder.first_name} {outfolder.last_name}</p>
                                                {outfolder.company_name && (
                                                    <span style={{ fontSize: '12px', padding: '2px 8px', backgroundColor: '#EFF6FF', color: '#2563EB', borderRadius: '4px', fontWeight: 500 }}>
                                                        {outfolder.company_name}
                                                    </span>
                                                )}
                                            </div>
                                            <div style={{ marginTop: '8px', display: 'flex', flexWrap: 'wrap', gap: '12px' }}>
                                                {outfolder.contacts?.filter(c => c.contact_type === 'phone' || c.contact_type === 'mobile').map((contact, i) => (
                                                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#6B7280' }}>
                                                        <Phone style={{ width: '12px', height: '12px' }} /> {contact.value}
                                                    </span>
                                                ))}
                                                {outfolder.contacts?.filter(c => c.contact_type === 'email').map((contact, i) => (
                                                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '13px', color: '#6B7280' }}>
                                                        <Mail style={{ width: '12px', height: '12px' }} /> {contact.value}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', gap: '8px' }}>
                                            <button onClick={() => startEditOutfolder(outfolder)} style={{ padding: '8px', backgroundColor: '#EFF6FF', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#2563EB' }}>
                                                <Edit2 style={{ width: '16px', height: '16px' }} />
                                            </button>
                                            <button onClick={() => outfolder.id && removeOutfolder(outfolder.id)} style={{ padding: '8px', backgroundColor: '#FEE2E2', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#DC2626' }}>
                                                <X style={{ width: '16px', height: '16px' }} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Add/Edit Supervisor Form */}
                    {(showAddOutfolder || editingOutfolderId) && (
                        <div style={{ padding: '20px', backgroundColor: '#F9FAFB', borderRadius: '12px', border: '1px dashed #D1D5DB' }}>
                            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#374151', marginBottom: '16px' }}>
                                {editingOutfolderId ? 'Edit Supervisor' : 'Add New Supervisor'}
                            </h3>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '16px', marginBottom: '20px' }}>
                                <div><label style={labelStyle}>First Name *</label><input type="text" value={newOutfolder.first_name} onChange={(e) => setNewOutfolder(s => ({ ...s, first_name: e.target.value }))} placeholder="John" style={inputStyle} /></div>
                                <div><label style={labelStyle}>Last Name *</label><input type="text" value={newOutfolder.last_name} onChange={(e) => setNewOutfolder(s => ({ ...s, last_name: e.target.value }))} placeholder="Doe" style={inputStyle} /></div>
                                <div><label style={labelStyle}>Rayon Name</label><input type="text" value={newOutfolder.company_name} onChange={(e) => setNewOutfolder(s => ({ ...s, company_name: e.target.value }))} placeholder="e.g. Rotterdam Noord" style={inputStyle} /></div>
                            </div>

                            {/* Phone Numbers */}
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <label style={{ ...labelStyle, marginBottom: 0 }}>Phone Numbers</label>
                                    <button onClick={() => addOutfolderContact('phone')} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', backgroundColor: '#EFF6FF', color: '#2563EB', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                                        <Plus style={{ width: '12px', height: '12px' }} /> Add
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {newOutfolder.contacts.map((contact, idx) => contact.contact_type === 'phone' || contact.contact_type === 'mobile' ? (
                                        <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <Phone style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#9CA3AF' }} />
                                                <input type="tel" value={contact.value} onChange={(e) => updateOutfolderContact(idx, e.target.value)} placeholder="+31 6 12345678" style={{ ...inputStyle, paddingLeft: '36px' }} />
                                            </div>
                                            {outfolderPhones.length > 1 && (
                                                <button onClick={() => removeOutfolderContact(idx)} style={{ padding: '10px', backgroundColor: '#FEE2E2', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#DC2626' }}>
                                                    <X style={{ width: '14px', height: '14px' }} />
                                                </button>
                                            )}
                                        </div>
                                    ) : null)}
                                </div>
                            </div>

                            {/* Email Addresses */}
                            <div style={{ marginBottom: '20px' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                                    <label style={{ ...labelStyle, marginBottom: 0 }}>Email Addresses</label>
                                    <button onClick={() => addOutfolderContact('email')} style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '4px 10px', backgroundColor: '#EFF6FF', color: '#2563EB', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                                        <Plus style={{ width: '12px', height: '12px' }} /> Add
                                    </button>
                                </div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                    {newOutfolder.contacts.map((contact, idx) => contact.contact_type === 'email' ? (
                                        <div key={idx} style={{ display: 'flex', gap: '8px' }}>
                                            <div style={{ position: 'relative', flex: 1 }}>
                                                <Mail style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', width: '14px', height: '14px', color: '#9CA3AF' }} />
                                                <input type="email" value={contact.value} onChange={(e) => updateOutfolderContact(idx, e.target.value)} placeholder="john@example.com" style={{ ...inputStyle, paddingLeft: '36px' }} />
                                            </div>
                                            {outfolderEmails.length > 1 && (
                                                <button onClick={() => removeOutfolderContact(idx)} style={{ padding: '10px', backgroundColor: '#FEE2E2', border: 'none', borderRadius: '8px', cursor: 'pointer', color: '#DC2626' }}>
                                                    <X style={{ width: '14px', height: '14px' }} />
                                                </button>
                                            )}
                                        </div>
                                    ) : null)}
                                    {outfolderEmails.length === 0 && (
                                        <p style={{ fontSize: '13px', color: '#9CA3AF', margin: 0 }}>Click "Add" to add an email address</p>
                                    )}
                                </div>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button onClick={() => { setShowAddOutfolder(false); cancelEdit(); }} style={{ padding: '10px 16px', backgroundColor: 'white', color: '#374151', border: '1px solid #E5E7EB', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                                    Cancel
                                </button>
                                <button onClick={handleSaveOutfolder} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '10px 16px', backgroundColor: '#16A34A', color: 'white', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                                    <Check style={{ width: '14px', height: '14px' }} /> {editingOutfolderId ? 'Save Changes' : 'Add Supervisor'}
                                </button>
                            </div>
                        </div>
                    )}

                    {outfolders.length === 0 && !showAddOutfolder && !editingOutfolderId && (
                        <p style={{ fontSize: '14px', color: '#9CA3AF', textAlign: 'center', margin: 0 }}>No supervisors added yet</p>
                    )}
                </div>

                {/* Financial Information Card */}
                <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E5E7EB', padding: '24px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ padding: '10px', backgroundColor: '#F0FDF4', borderRadius: '10px' }}>
                            <CreditCard style={{ width: '20px', height: '20px', color: '#16A34A' }} />
                        </div>
                        <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>Financial Information</h2>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
                        <div><label style={labelStyle}>IBAN</label><input type="text" value={editForm.iban} onChange={(e) => setEditForm(f => ({ ...f, iban: e.target.value.toUpperCase() }))} placeholder="NL00BANK0000000000" style={inputStyle} /></div>
                        <div><label style={labelStyle}>G-Rekening</label><input type="text" value={editForm.g_rekening} onChange={(e) => setEditForm(f => ({ ...f, g_rekening: e.target.value.toUpperCase() }))} placeholder="NL00BANK0000000000" style={inputStyle} /></div>
                        <div><label style={labelStyle}>BTW Number</label><input type="text" value={editForm.btw_number} onChange={(e) => setEditForm(f => ({ ...f, btw_number: e.target.value.toUpperCase() }))} placeholder="NL123456789B01" style={inputStyle} /></div>
                        <div><label style={labelStyle}>KvK Number</label><input type="text" value={editForm.kvk_number} onChange={(e) => setEditForm(f => ({ ...f, kvk_number: e.target.value }))} placeholder="12345678" maxLength={8} style={inputStyle} /></div>
                    </div>
                </div>
                {/* Services Configuration Card (with integrated surcharges) */}
                <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E5E7EB', padding: '24px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Briefcase style={{ width: '20px', height: '20px', color: '#7C3AED' }} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>Services Configuration</h2>
                            <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Select services and set prices for this customer</p>
                        </div>
                    </div>

                    {/* Enable Service Surcharges Toggle */}
                    <div
                        onClick={() => setHasServiceSurcharges(!hasServiceSurcharges)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 18px',
                            backgroundColor: hasServiceSurcharges ? 'rgba(124, 58, 237, 0.05)' : '#F9FAFB',
                            border: `2px solid ${hasServiceSurcharges ? '#7C3AED' : '#E5E7EB'}`,
                            borderRadius: '12px',
                            cursor: 'pointer',
                            marginBottom: '20px',
                        }}
                    >
                        <div>
                            <p style={{ fontSize: '14px', fontWeight: 600, color: hasServiceSurcharges ? '#1F2937' : '#6B7280', margin: 0 }}>Enable Percentage Surcharges</p>
                            <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '2px 0 0' }}>Add extra rates for weekends, nights, holidays on services</p>
                        </div>
                        <div style={{
                            width: '44px',
                            height: '26px',
                            borderRadius: '13px',
                            backgroundColor: hasServiceSurcharges ? '#7C3AED' : '#D1D5DB',
                            position: 'relative',
                            transition: 'all 0.15s ease',
                        }}>
                            <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                backgroundColor: 'white',
                                position: 'absolute',
                                top: '3px',
                                left: hasServiceSurcharges ? '21px' : '3px',
                                transition: 'all 0.15s ease',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            }} />
                        </div>
                    </div>

                    {/* Service Surcharge Types List */}
                    {hasServiceSurcharges && surchargeTypes.length > 0 && (
                        <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#F5F3FF', borderRadius: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <Percent size={14} color="#7C3AED" />
                                <span style={{ fontSize: '12px', fontWeight: 600, color: '#7C3AED', textTransform: 'uppercase' }}>Service Surcharge Types</span>
                            </div>
                            <div style={{ display: 'grid', gap: '8px' }}>
                                {surchargeTypes.map((st) => {
                                    const surcharge = selectedServiceSurcharges.find(s => s.surcharge_type === st.id);
                                    const isSelected = surcharge?.is_enabled || false;
                                    const percentage = surcharge?.percentage || 25;

                                    return (
                                        <div
                                            key={st.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                padding: '10px 14px',
                                                backgroundColor: isSelected ? '#EDE9FE' : 'white',
                                                border: `1px solid ${isSelected ? '#7C3AED' : '#E5E7EB'}`,
                                                borderRadius: '8px',
                                            }}
                                        >
                                            <button
                                                onClick={() => toggleServiceSurcharge(st.id)}
                                                style={{
                                                    width: '20px',
                                                    height: '20px',
                                                    borderRadius: '4px',
                                                    backgroundColor: isSelected ? '#7C3AED' : 'white',
                                                    border: isSelected ? 'none' : '2px solid #D1D5DB',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    flexShrink: 0
                                                }}
                                            >
                                                {isSelected && <Check size={12} color="white" />}
                                            </button>
                                            <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: isSelected ? '#1F2937' : '#6B7280' }}>{st.name}</span>
                                            {isSelected && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        value={percentage === 0 ? '' : percentage}
                                                        onChange={(e) => updateServiceSurchargePercentage(st.id, e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={{
                                                            width: '60px',
                                                            padding: '4px 8px',
                                                            fontSize: '13px',
                                                            fontWeight: 600,
                                                            color: '#111827',
                                                            border: '1px solid #D1D5DB',
                                                            borderRadius: '6px',
                                                            outline: 'none',
                                                            textAlign: 'center'
                                                        }}
                                                    />
                                                    <span style={{ fontSize: '12px', color: '#6B7280' }}>%</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {/* Services List */}
                    {availableServices.length === 0 ? (
                        <p style={{ fontSize: '14px', color: '#9CA3AF', fontStyle: 'italic' }}>No services available. Add some in Services Management.</p>
                    ) : (
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {availableServices.map((svc) => {
                                const rate = serviceRates.find(sr => sr.service_id === svc.id);
                                const isSelected = rate?.is_active || false;
                                const price = rate?.price || 0;

                                return (
                                    <div
                                        key={svc.id}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '16px',
                                            padding: '16px 20px',
                                            backgroundColor: isSelected ? '#F5F3FF' : '#F9FAFB',
                                            border: `2px solid ${isSelected ? '#7C3AED' : '#E5E7EB'}`,
                                            borderRadius: '12px',
                                        }}
                                    >
                                        {/* Checkbox */}
                                        <button
                                            onClick={() => toggleService(svc.id)}
                                            style={{
                                                width: '24px',
                                                height: '24px',
                                                borderRadius: '6px',
                                                backgroundColor: isSelected ? '#7C3AED' : 'white',
                                                border: isSelected ? 'none' : '2px solid #D1D5DB',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                cursor: 'pointer',
                                                flexShrink: 0
                                            }}
                                        >
                                            {isSelected && <CheckCircle size={16} color="white" />}
                                        </button>

                                        {/* Service Icon */}
                                        <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: isSelected ? '#EDE9FE' : '#F3F4F6', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                            <Briefcase size={16} color={isSelected ? '#7C3AED' : '#9CA3AF'} />
                                        </div>

                                        {/* Service Name and Code */}
                                        <div style={{ flex: 1 }}>
                                            <p style={{ fontSize: '14px', fontWeight: 600, color: isSelected ? '#1F2937' : '#6B7280', margin: 0 }}>{svc.name}</p>
                                            {svc.code && <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '2px 0 0' }}>Code: {svc.code}</p>}
                                        </div>

                                        {/* Price Input */}
                                        {isSelected && (
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                <span style={{ fontSize: '14px', color: '#6B7280' }}>€</span>
                                                <input
                                                    type="number"
                                                    min="0"
                                                    step="0.01"
                                                    value={price}
                                                    onChange={(e) => updateServicePrice(svc.id, parseFloat(e.target.value) || 0)}
                                                    style={{
                                                        width: '100px',
                                                        padding: '8px 12px',
                                                        fontSize: '14px',
                                                        fontWeight: 600,
                                                        color: '#111827',
                                                        border: '1px solid #EDE9FE',
                                                        borderRadius: '8px',
                                                        outline: 'none',
                                                        backgroundColor: 'white',
                                                        textAlign: 'center'
                                                    }}
                                                />
                                                <span style={{ fontSize: '12px', color: '#6B7280' }}>per hour</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Allowances Configuration Card (with integrated surcharges) */}
                <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E5E7EB', padding: '24px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <Gift style={{ width: '20px', height: '20px', color: '#DC2626' }} />
                            </div>
                            <div>
                                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>Allowances Configuration</h2>
                                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Custom allowances for this customer (e.g., Mask, Hazard Pay)</p>
                            </div>
                        </div>
                        <button
                            onClick={addCustomAllowance}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '6px',
                                padding: '8px 14px', backgroundColor: '#DC2626', color: 'white',
                                border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer'
                            }}
                        >
                            <Plus size={14} /> Add Allowance
                        </button>
                    </div>

                    {/* Enable Allowance Surcharges Toggle */}
                    <div
                        onClick={() => setHasAllowanceSurcharges(!hasAllowanceSurcharges)}
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'space-between',
                            padding: '14px 18px',
                            backgroundColor: hasAllowanceSurcharges ? 'rgba(220, 38, 38, 0.05)' : '#F9FAFB',
                            border: `2px solid ${hasAllowanceSurcharges ? '#DC2626' : '#E5E7EB'}`,
                            borderRadius: '12px',
                            cursor: 'pointer',
                            marginBottom: '20px',
                        }}
                    >
                        <div>
                            <p style={{ fontSize: '14px', fontWeight: 600, color: hasAllowanceSurcharges ? '#1F2937' : '#6B7280', margin: 0 }}>Enable Percentage Surcharges</p>
                            <p style={{ fontSize: '12px', color: '#9CA3AF', margin: '2px 0 0' }}>Add extra rates for weekends, nights, holidays on allowances</p>
                        </div>
                        <div style={{
                            width: '44px',
                            height: '26px',
                            borderRadius: '13px',
                            backgroundColor: hasAllowanceSurcharges ? '#DC2626' : '#D1D5DB',
                            position: 'relative',
                            transition: 'all 0.15s ease',
                        }}>
                            <div style={{
                                width: '20px',
                                height: '20px',
                                borderRadius: '50%',
                                backgroundColor: 'white',
                                position: 'absolute',
                                top: '3px',
                                left: hasAllowanceSurcharges ? '21px' : '3px',
                                transition: 'all 0.15s ease',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                            }} />
                        </div>
                    </div>

                    {/* Allowance Surcharge Types List */}
                    {hasAllowanceSurcharges && surchargeTypes.length > 0 && (
                        <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#FEF2F2', borderRadius: '10px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                <Percent size={14} color="#DC2626" />
                                <span style={{ fontSize: '12px', fontWeight: 600, color: '#DC2626', textTransform: 'uppercase' }}>Allowance Surcharge Types</span>
                            </div>
                            <div style={{ display: 'grid', gap: '8px' }}>
                                {surchargeTypes.map((st) => {
                                    const surcharge = selectedAllowanceSurcharges.find(s => s.surcharge_type === st.id);
                                    const isSelected = surcharge?.is_enabled || false;
                                    const percentage = surcharge?.percentage || 25;

                                    return (
                                        <div
                                            key={st.id}
                                            style={{
                                                display: 'flex',
                                                alignItems: 'center',
                                                gap: '12px',
                                                padding: '10px 14px',
                                                backgroundColor: isSelected ? '#FEE2E2' : 'white',
                                                border: `1px solid ${isSelected ? '#DC2626' : '#E5E7EB'}`,
                                                borderRadius: '8px',
                                            }}
                                        >
                                            <button
                                                onClick={() => toggleAllowanceSurcharge(st.id)}
                                                style={{
                                                    width: '20px',
                                                    height: '20px',
                                                    borderRadius: '4px',
                                                    backgroundColor: isSelected ? '#DC2626' : 'white',
                                                    border: isSelected ? 'none' : '2px solid #D1D5DB',
                                                    display: 'flex',
                                                    alignItems: 'center',
                                                    justifyContent: 'center',
                                                    cursor: 'pointer',
                                                    flexShrink: 0
                                                }}
                                            >
                                                {isSelected && <Check size={12} color="white" />}
                                            </button>
                                            <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: isSelected ? '#1F2937' : '#6B7280' }}>{st.name}</span>
                                            {isSelected && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                                    <input
                                                        type="number"
                                                        min="0"
                                                        step="1"
                                                        value={percentage === 0 ? '' : percentage}
                                                        onChange={(e) => updateAllowanceSurchargePercentage(st.id, e.target.value === '' ? 0 : parseFloat(e.target.value))}
                                                        onClick={(e) => e.stopPropagation()}
                                                        style={{
                                                            width: '60px',
                                                            padding: '4px 8px',
                                                            fontSize: '13px',
                                                            fontWeight: 600,
                                                            color: '#111827',
                                                            border: '1px solid #D1D5DB',
                                                            borderRadius: '6px',
                                                            outline: 'none',
                                                            textAlign: 'center'
                                                        }}
                                                    />
                                                    <span style={{ fontSize: '12px', color: '#6B7280' }}>%</span>
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {customerAllowances.length === 0 ? (
                        <p style={{ fontSize: '14px', color: '#9CA3AF', fontStyle: 'italic', textAlign: 'center', padding: '24px' }}>
                            No allowances configured. Click "Add Allowance" to select from available types.
                        </p>
                    ) : (
                        <div style={{ display: 'grid', gap: '12px' }}>
                            {customerAllowances.map((allowance, index) => (
                                <div
                                    key={index}
                                    style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '16px',
                                        padding: '16px 20px',
                                        backgroundColor: '#FEF2F2',
                                        border: '2px solid #FECACA',
                                        borderRadius: '12px',
                                    }}
                                >
                                    {/* Allowance Type Dropdown or Custom Name */}
                                    <select
                                        value={allowance.allowance_type || 'custom'}
                                        onChange={(e) => {
                                            const value = e.target.value;
                                            if (value === 'custom') {
                                                updateCustomAllowance(index, 'allowance_type', undefined);
                                            } else {
                                                const typeId = parseInt(value);
                                                const type = availableAllowances.find(t => t.id === typeId);
                                                if (type) {
                                                    setCustomerAllowances(prev => prev.map((a, i) =>
                                                        i === index ? {
                                                            ...a,
                                                            allowance_type: typeId,
                                                            custom_name: type.name,
                                                            price: parseFloat(type.base_price) || 0
                                                        } : a
                                                    ));
                                                }
                                            }
                                        }}
                                        style={{
                                            width: '200px',
                                            padding: '10px 14px',
                                            fontSize: '14px',
                                            border: '1px solid #E5E7EB',
                                            borderRadius: '8px',
                                            outline: 'none',
                                            backgroundColor: 'white'
                                        }}
                                    >
                                        <option value="custom">-- Custom --</option>
                                        {availableAllowances.filter(t => t.is_active).map(type => (
                                            <option key={type.id} value={type.id}>
                                                {type.name} ({type.code}) - €{parseFloat(type.base_price).toFixed(2)}
                                            </option>
                                        ))}
                                    </select>

                                    {/* Custom Name (only shown if custom selected) */}
                                    {!allowance.allowance_type && (
                                        <>
                                            <input
                                                type="text"
                                                placeholder="Name..."
                                                value={allowance.custom_name}
                                                onChange={(e) => updateCustomAllowance(index, 'custom_name', e.target.value)}
                                                style={{
                                                    width: '150px',
                                                    padding: '10px 14px',
                                                    fontSize: '14px',
                                                    border: '1px solid #E5E7EB',
                                                    borderRadius: '8px',
                                                    outline: 'none',
                                                }}
                                            />
                                            <input
                                                type="text"
                                                placeholder="Code..."
                                                value={allowance.custom_code || ''}
                                                onChange={(e) => updateCustomAllowance(index, 'custom_code', e.target.value.toUpperCase())}
                                                maxLength={10}
                                                style={{
                                                    width: '90px',
                                                    padding: '10px 14px',
                                                    fontSize: '14px',
                                                    fontFamily: 'monospace',
                                                    textTransform: 'uppercase',
                                                    border: '1px solid #E5E7EB',
                                                    borderRadius: '8px',
                                                    outline: 'none',
                                                }}
                                            />
                                        </>
                                    )}

                                    {/* Price */}
                                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                        <span style={{ fontSize: '14px', color: '#6B7280' }}>€</span>
                                        <input
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            value={allowance.price}
                                            onChange={(e) => updateCustomAllowance(index, 'price', parseFloat(e.target.value) || 0)}
                                            style={{
                                                width: '80px',
                                                padding: '10px 12px',
                                                fontSize: '14px',
                                                fontWeight: 600,
                                                border: '1px solid #E5E7EB',
                                                borderRadius: '8px',
                                                outline: 'none',
                                                textAlign: 'center'
                                            }}
                                        />
                                        <span style={{ fontSize: '12px', color: '#6B7280' }}>/hr</span>
                                    </div>

                                    {/* Apply Surcharges Toggle */}
                                    <button
                                        onClick={() => updateCustomAllowance(index, 'apply_surcharges', !allowance.apply_surcharges)}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: '6px',
                                            padding: '8px 12px',
                                            backgroundColor: allowance.apply_surcharges ? '#DCFCE7' : '#F3F4F6',
                                            border: `1px solid ${allowance.apply_surcharges ? '#22C55E' : '#D1D5DB'}`,
                                            borderRadius: '8px',
                                            fontSize: '12px',
                                            fontWeight: 500,
                                            color: allowance.apply_surcharges ? '#16A34A' : '#6B7280',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        {allowance.apply_surcharges ? '✓ Surcharges' : '○ No Surcharges'}
                                    </button>

                                    {/* Remove Button */}
                                    <button
                                        onClick={() => removeCustomAllowance(index)}
                                        style={{
                                            padding: '8px',
                                            backgroundColor: '#FEE2E2',
                                            border: 'none',
                                            borderRadius: '6px',
                                            cursor: 'pointer'
                                        }}
                                    >
                                        <Trash2 size={16} color="#DC2626" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Allowances Configuration Card */}
                <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E5E7EB', padding: '24px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
                        <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <Gift style={{ width: '20px', height: '20px', color: '#F59E0B' }} />
                        </div>
                        <div>
                            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>Allowances Configuration (Toeslag)</h2>
                            <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>Select which allowances this customer pays for</p>
                        </div>
                    </div>

                    {availableAllowances.length === 0 ? (
                        <p style={{ fontSize: '14px', color: '#9CA3AF', textAlign: 'center' }}>
                            No allowance types available. <a href="/dashboard/allowance-types" style={{ color: '#059669' }}>Create some first</a>.
                        </p>
                    ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                            {availableAllowances.filter(at => at.is_active).map((allowance) => {
                                const customerAllowance = customerAllowances.find(a => a.allowance_type === allowance.id);
                                const isEnabled = customerAllowance?.is_enabled || false;
                                const customPrice = customerAllowance?.custom_price;
                                const applySurcharges = customerAllowance?.apply_surcharges ?? true;

                                return (
                                    <div
                                        key={allowance.id}
                                        style={{
                                            padding: '16px',
                                            borderRadius: '12px',
                                            border: `2px solid ${isEnabled ? '#F59E0B' : '#E5E7EB'}`,
                                            backgroundColor: isEnabled ? '#FFFBEB' : '#F9FAFB',
                                        }}
                                    >
                                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                <button
                                                    type="button"
                                                    onClick={() => toggleAllowance(allowance.id)}
                                                    style={{
                                                        width: '24px',
                                                        height: '24px',
                                                        borderRadius: '6px',
                                                        border: `2px solid ${isEnabled ? '#F59E0B' : '#D1D5DB'}`,
                                                        backgroundColor: isEnabled ? '#F59E0B' : 'white',
                                                        cursor: 'pointer',
                                                        display: 'flex',
                                                        alignItems: 'center',
                                                        justifyContent: 'center',
                                                    }}
                                                >
                                                    {isEnabled && <Check size={14} style={{ color: 'white' }} />}
                                                </button>
                                                <div style={{ width: '32px', height: '32px', borderRadius: '8px', backgroundColor: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                                    <Gift size={16} style={{ color: '#F59E0B' }} />
                                                </div>
                                                <div>
                                                    <div style={{ fontWeight: 600, color: '#111827' }}>{allowance.name}</div>
                                                    <div style={{ fontSize: '12px', color: '#6B7280' }}>Code: {allowance.code} • Base: €{parseFloat(allowance.base_price).toFixed(2)}/hr</div>
                                                </div>
                                            </div>

                                            {isEnabled && (
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                                        <span style={{ fontSize: '13px', color: '#6B7280' }}>Custom €</span>
                                                        <input
                                                            type="number"
                                                            step="0.01"
                                                            placeholder={allowance.base_price}
                                                            value={customPrice || ''}
                                                            onChange={(e) => updateAllowanceCustomPrice(allowance.id, e.target.value ? parseFloat(e.target.value) : undefined)}
                                                            style={{
                                                                width: '80px',
                                                                padding: '6px 10px',
                                                                fontSize: '14px',
                                                                border: '1px solid #FCD34D',
                                                                borderRadius: '8px',
                                                                outline: 'none',
                                                                textAlign: 'center',
                                                            }}
                                                        />
                                                        <span style={{ fontSize: '13px', color: '#6B7280' }}>/hr</span>
                                                    </div>
                                                    <div style={{ padding: '6px 12px', backgroundColor: '#FEF3C7', borderRadius: '8px' }}>
                                                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#F59E0B' }}>
                                                            €{customPrice !== undefined ? customPrice.toFixed(2) : parseFloat(allowance.base_price).toFixed(2)}/hr
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Surcharges for this allowance */}
                                        {isEnabled && hasSurcharges && (
                                            <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid #FCD34D' }}>
                                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px' }}>
                                                    <button
                                                        type="button"
                                                        onClick={() => toggleAllowanceSurcharges(allowance.id)}
                                                        style={{
                                                            width: '40px',
                                                            height: '22px',
                                                            backgroundColor: applySurcharges ? '#059669' : '#D1D5DB',
                                                            borderRadius: '11px',
                                                            border: 'none',
                                                            cursor: 'pointer',
                                                            position: 'relative',
                                                        }}
                                                    >
                                                        <div style={{
                                                            position: 'absolute',
                                                            top: '2px',
                                                            left: applySurcharges ? '20px' : '2px',
                                                            width: '18px',
                                                            height: '18px',
                                                            backgroundColor: 'white',
                                                            borderRadius: '50%',
                                                            transition: 'left 0.2s',
                                                        }} />
                                                    </button>
                                                    <span style={{ fontSize: '13px', color: '#374151' }}>Apply surcharges to this allowance</span>
                                                </div>

                                                {applySurcharges && selectedSurcharges.filter(s => s.is_enabled).length > 0 && (
                                                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                                        {selectedSurcharges.filter(s => s.is_enabled).map(surcharge => {
                                                            const isSelected = customerAllowance?.enabled_surcharges_ids?.includes(surcharge.surcharge_type) || false;
                                                            return (
                                                                <button
                                                                    key={surcharge.surcharge_type}
                                                                    type="button"
                                                                    onClick={() => toggleAllowanceSurchargeType(allowance.id, surcharge.surcharge_type)}
                                                                    style={{
                                                                        padding: '6px 12px',
                                                                        borderRadius: '8px',
                                                                        border: `1px solid ${isSelected ? '#059669' : '#E5E7EB'}`,
                                                                        backgroundColor: isSelected ? '#D1FAE5' : 'white',
                                                                        color: isSelected ? '#059669' : '#6B7280',
                                                                        fontSize: '12px',
                                                                        fontWeight: 500,
                                                                        cursor: 'pointer',
                                                                    }}
                                                                >
                                                                    {surcharge.surcharge_type_name} ({surcharge.percentage}%)
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>

                {/* Contract History Card */}

                <div style={{ backgroundColor: 'white', borderRadius: '16px', border: '1px solid #E5E7EB', padding: '24px', marginBottom: '24px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <div style={{ width: '40px', height: '40px', borderRadius: '10px', backgroundColor: '#DBEAFE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <FileText style={{ width: '20px', height: '20px', color: '#3B82F6' }} />
                            </div>
                            <div>
                                <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', margin: 0 }}>Contract History</h2>
                                <p style={{ fontSize: '13px', color: '#6B7280', margin: 0 }}>All contracts and rate changes</p>
                            </div>
                        </div>
                        <button
                            onClick={() => {
                                setNewContractRate('');
                                setNewContractEffectiveFrom(new Date().toISOString().split('T')[0]);
                                setShowContractUploadModal(true);
                            }}
                            style={{
                                display: 'flex', alignItems: 'center', gap: '8px',
                                padding: '10px 16px', backgroundColor: '#3B82F6', color: 'white',
                                border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: 'pointer',
                            }}
                        >
                            <Upload size={16} />
                            Upload Contract
                        </button>
                    </div>

                    {contractHistory.length > 0 ? (
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '14px' }}>
                            <thead>
                                <tr style={{ borderBottom: '1px solid #E5E7EB', color: '#6B7280', textAlign: 'left' }}>
                                    <th style={{ padding: '12px 8px', fontWeight: 600 }}>Effective From</th>
                                    <th style={{ padding: '12px 8px', fontWeight: 600 }}>Effective To</th>
                                    <th style={{ padding: '12px 8px', fontWeight: 600 }}>Services</th>
                                    <th style={{ padding: '12px 8px', fontWeight: 600 }}>Uploaded By</th>
                                    <th style={{ padding: '12px 8px', fontWeight: 600 }}>Document</th>
                                </tr>
                            </thead>
                            <tbody>
                                {contractHistory.map((contract) => (
                                    <tr key={contract.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                                        <td style={{ padding: '12px 8px', color: '#374151' }}>{new Date(contract.effective_from).toLocaleDateString()}</td>
                                        <td style={{ padding: '12px 8px', color: '#374151' }}>
                                            {contract.effective_to
                                                ? new Date(contract.effective_to).toLocaleDateString()
                                                : <span style={{ color: '#059669', fontWeight: 500, backgroundColor: '#D1FAE5', padding: '2px 8px', borderRadius: '4px', fontSize: '12px' }}>Current</span>
                                            }
                                        </td>
                                        <td style={{ padding: '12px 8px', color: '#6B7280' }}>
                                            {contract.service_rates_snapshot && contract.service_rates_snapshot.length > 0
                                                ? `${contract.service_rates_snapshot.length} service(s)`
                                                : '-'}
                                        </td>

                                        <td style={{ padding: '12px 8px', color: '#6B7280' }}>{contract.uploaded_by_name || '-'}</td>
                                        <td style={{ padding: '12px 8px' }}>
                                            {contract.contract_document_url && (
                                                <a
                                                    href={contract.contract_document_url}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', color: '#3B82F6', textDecoration: 'none', fontSize: '13px', fontWeight: 500 }}
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
                        <div style={{ textAlign: 'center', padding: '40px', color: '#9CA3AF' }}>
                            <FileText size={48} style={{ opacity: 0.5, marginBottom: '12px' }} />
                            <p style={{ margin: 0 }}>No contracts uploaded yet</p>
                            <p style={{ fontSize: '13px', margin: '4px 0 0' }}>Click "Upload Contract" to add your first contract</p>
                        </div>
                    )}
                </div>

                {/* Contract Upload Modal */}
                {showContractUploadModal && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowContractUploadModal(false)} />
                        <div style={{ position: 'relative', backgroundColor: 'white', borderRadius: '16px', padding: '32px', maxWidth: '500px', width: '100%' }}>
                            <h3 style={{ fontSize: '18px', fontWeight: 600, color: '#111827', marginBottom: '24px' }}>Upload New Contract</h3>

                            <div style={{ marginBottom: '20px' }}>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>Contract Document *</label>
                                <input
                                    type="file"
                                    accept=".pdf,.doc,.docx"
                                    onChange={(e) => setNewContractFile(e.target.files?.[0] || null)}
                                    style={{ width: '100%', padding: '12px', border: '1px solid #E5E7EB', borderRadius: '8px' }}
                                />
                            </div>

                            <div style={{ marginBottom: '24px' }}>
                                <label style={{ display: 'block', fontSize: '14px', fontWeight: 500, color: '#374151', marginBottom: '8px' }}>Effective From *</label>
                                <input
                                    type="date"
                                    value={newContractEffectiveFrom}
                                    onChange={(e) => setNewContractEffectiveFrom(e.target.value)}
                                    style={{ width: '100%', padding: '12px', border: '1px solid #E5E7EB', borderRadius: '8px' }}
                                />
                                <p style={{ fontSize: '12px', color: '#6B7280', marginTop: '4px' }}>You can set a future date - the contract will activate on that date</p>
                            </div>

                            <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
                                <button
                                    onClick={() => setShowContractUploadModal(false)}
                                    style={{ padding: '10px 20px', border: '1px solid #E5E7EB', borderRadius: '8px', backgroundColor: 'white', cursor: 'pointer' }}
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleUploadContract}
                                    disabled={uploadingContract}
                                    style={{
                                        padding: '10px 20px', backgroundColor: '#3B82F6', color: 'white',
                                        border: 'none', borderRadius: '8px', cursor: 'pointer',
                                        opacity: uploadingContract ? 0.5 : 1,
                                    }}
                                >
                                    {uploadingContract ? 'Uploading...' : 'Upload Contract'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Delete Confirmation Modal */}
                {showDeleteConfirm && (
                    <div style={{ position: 'fixed', inset: 0, zIndex: 50, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                        <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.5)' }} onClick={() => setShowDeleteConfirm(false)} />
                        <div style={{ position: 'relative', backgroundColor: 'white', borderRadius: '16px', padding: '32px', maxWidth: '420px', width: '100%', textAlign: 'center' }}>
                            <div style={{ width: '64px', height: '64px', borderRadius: '32px', backgroundColor: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 20px' }}>
                                <AlertTriangle style={{ width: '32px', height: '32px', color: '#DC2626' }} />
                            </div>
                            <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#111827', marginBottom: '8px' }}>Delete Customer</h3>
                            <p style={{ fontSize: '14px', color: '#6B7280', marginBottom: '24px' }}>
                                Are you sure you want to delete <strong>{customer.company_name}</strong>? This action cannot be undone.
                            </p>
                            <div style={{ display: 'flex', gap: '12px' }}>
                                <button onClick={() => setShowDeleteConfirm(false)} style={{ flex: 1, padding: '12px', backgroundColor: 'white', border: '1px solid #E5E7EB', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
                                <button onClick={handleDelete} disabled={deleting} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', padding: '12px', backgroundColor: '#DC2626', color: 'white', border: 'none', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.7 : 1 }}>
                                    <Trash2 style={{ width: '16px', height: '16px' }} /> {deleting ? 'Deleting...' : 'Delete'}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </DashboardLayout>
    );
}
